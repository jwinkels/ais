
import * as yaml from "yaml";
import * as fs from 'fs';
import * as vscode from 'vscode';
import { posix } from 'path';
import * as httpm from 'typed-rest-client/HttpClient';

export class Cache {

    private objects:any= {
        lastUpdate: null,
        items: [],
        packages: [],
        methods: []
    };

    private argument={
        name:"",
        type:"",
        return:false
    };

    public getCache():any{
        return this.objects;
    }

    public setApexVersion(version:number, minor:string):any{
        let cache = this.objects;
        try {
            if (version){
                cache["apexVersion"] = version;
                cache["minorVersion"] = minor;
            }
            return cache;
        } catch (error) {
            console.log(error);
        }
    }
    
    public addItem(name:string|undefined):any{
        let cache = this.objects;
        try{
            if (name && !cache.items.includes(name)){
                cache.items.push(name);
            }
            return cache;
        }catch(err){
            console.log(err);
        }
    }

    public addPackage(name:string|undefined, owner:string|null, status:string|undefined):any{

        let cache = this.objects;
        let index = cache.packages.findIndex((aPackage:{name:string, owner:string})=>aPackage.name===name && aPackage.owner===owner);
        if(name && index === -1){
            if(status === "PUBLIC"){
                owner=null;
            }
            cache.packages.push({name: name, owner: owner, status: status, methods:[], variables: []});
        }
    }

    public addMethod(methodName:string|undefined, methodId:number|undefined, owner:string|undefined){
        try{
            let cache = this.objects;    

            let index = cache.methods.findIndex((aMethod:{name:string, owner:string})=>aMethod.name===methodName && aMethod.owner===(owner?owner:null));

            if (methodName && index === -1){ 
                cache.methods.push({name: methodName, owner: owner, methodId: methodId, arguments:{}});
            }
            
            return cache;   
        }catch(err){
            console.log(err);
        }
    }

    public addMethodToPackage(methodName:string|undefined, methodId:number|undefined, packageName:string|undefined, owner:string|undefined, status:string|undefined){

        let cache = this.objects;

        if (status = "PUBLIC"){
            owner = undefined;
        }

        let index = cache.packages.findIndex((aPackage:{name:string, owner:string})=>aPackage.name===packageName && aPackage.owner===(owner ? owner : null));
        if(methodName 
            && methodId
            ){    
            if (cache.packages[index].methods.filter((aMethod: 
                                                               {name:string; id:number})=>
                                                               aMethod.name===methodName && 
                                                               aMethod.id===methodId
                                                            ).length===0
                
            ){
                cache.packages[index].methods.push({name: methodName, id: methodId, arguments: {}});
            }
        }  
    }

    public addGlobalVariableToPackage(variableName:string|undefined, value:string|undefined, packageName:string|undefined, owner:string|undefined){
        let cache = this.objects;
        let index = cache.packages.findIndex((aPackage:{name:string, owner:string})=>aPackage.name===packageName && aPackage.owner===(owner?owner:null));
        if (variableName){
            if (cache.packages[index].variables.filter((aVariable: 
                {name:string; value:string})=>
                aVariable.name===variableName
             ).length===0
            ){
                cache.packages[index].variables.push({name: variableName, value: value});
            }
        }

    }

    public addArgumentToMethod(argumentName:string|undefined, type:string|undefined, methodName:string|undefined, methodId:number, packageName:string|undefined, owner:string|undefined, status:string|undefined){
        
        if (argumentName){
            this.argument.name ="" + argumentName;
        }else{
            this.argument.name ="RETURN";
        }

        if(status === "PUBLIC"){
            owner=undefined;
        }
        
        let packageIndex = this.objects.packages.findIndex((aPackage:{name:string, owner:string})=>aPackage.name===packageName && aPackage.owner===(owner?owner:null));
        let methodIndex = this.objects.methods.findIndex((aMethod:{name:string, owner:string})=>aMethod.name===methodName && aMethod.owner===(owner?owner:null));
        
        if(type 
                && methodName 
                && packageName
                && packageIndex!==-1
                ){
            let index = this.objects.packages[packageIndex].methods.findIndex((aMethod:{name:string; id:number})=>aMethod.name===methodName && aMethod.id===methodId);
            if (index >= 0){
                this.objects.packages[packageIndex].methods[index].arguments[this.argument.name]={};
                this.objects.packages[packageIndex].methods[index].arguments[this.argument.name].type = type;
                
                if (!argumentName){
                    this.objects.packages[packageIndex].methods[index].arguments[this.argument.name].return = true;
                }
            }else{
                console.log('Method not found!');
            }
        }else if (type 
                    && methodName 
                    && methodIndex!==-1){       
            if (!this.objects.methods[methodIndex].arguments[ this.argument.name ]){

                this.objects.methods[methodIndex].arguments[ this.argument.name ]={};
                this.objects.methods[methodIndex].arguments[ this.argument.name ].type = type;

                if (!argumentName){
                    this.objects.methods[methodIndex].arguments[ this.argument.name ].return = true;
                }

            }
        }
    }

    public async load():Promise<any>{        
        try{
            if(!vscode.workspace.workspaceFolders){
                vscode.window.showInformationMessage('No folder or workspace opened');
                return undefined;
            }
            
            
            const currentPath = vscode.workspace.workspaceFolders[0].uri;
            const fileUri     = currentPath.with({path: posix.join(currentPath.path,'.ais','cache.yaml')});

            let objectString = Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString();
            this.objects=yaml.parse(objectString);
            return this;
        }catch(err){
            console.log(err);
            return this;
        }
    }

    public serialize(){
        try{
            if(!vscode.workspace.workspaceFolders){
                return vscode.window.showInformationMessage('No folder or workspace opened');
            }
            
            const currentPath = vscode.workspace.workspaceFolders[0].uri;
            const fileUri     = currentPath.with({path: posix.join(currentPath.path,'.ais','cache.yaml')});

            vscode.workspace.fs.writeFile(fileUri, Buffer.from(yaml.stringify(this.objects)));
        }catch(err){
            console.log(err);
        }
    }

    public async loadApexPackages(cacheFilePath:string|undefined):Promise<any>{
        //const folderUri = vscode.workspace.workspaceFolders.;
        let fileUri:any;
        try{
            if(!vscode.workspace.workspaceFolders){
                vscode.window.showInformationMessage('No folder or workspace opened');
                return undefined;
            }

            if (!cacheFilePath){
                const currentPath = vscode.workspace.workspaceFolders[0].uri;    
                fileUri = currentPath.with({path: posix.join(currentPath.path,'.ais','apex.yaml')});
            }else{
                fileUri = vscode.Uri.parse('file:'+cacheFilePath);
            }

            let objectString = Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString();
            this.objects=yaml.parse(objectString);
            this.setApexVersion(this.objects.apexVersion, this.objects.minorVersion);
            return this;
        }catch(err){
            console.log(err);
            return this;
        }
    }

    public serializeApexPackages(cache:any){
        try{
            if(!vscode.workspace.workspaceFolders){
                return vscode.window.showInformationMessage('No folder or workspace opened');
            }

            const currentPath = vscode.workspace.workspaceFolders[0].uri;
            const fileUri     = currentPath.with({path: posix.join(currentPath.path,'.ais','apex.yaml')});
         
            if (!cache){
                cache = this.objects;
            }
            vscode.workspace.fs.writeFile(fileUri, Buffer.from(yaml.stringify(cache)));
        }catch(err){
            console.log(err);
        }
    }

    public static async loadApexApi(applicationServer:string, imageDirectory:string){
        let httpc: httpm.HttpClient = new httpm.HttpClient('ApexIntelliSense');
        let res: httpm.HttpClientResponse;
        const apiFileName    = 'apex-js-api.d.ts';
        const apiPath:string = 'libraries/monaco-editor/apex/' + apiFileName;

        try{
            if(!vscode.workspace.workspaceFolders){
                return vscode.window.showInformationMessage('No folder or workspace opened');
            }
            
            const currentPath    = vscode.workspace.workspaceFolders[0].uri;
            const apiFileUri     = currentPath.with({path: posix.join(currentPath.path,'.ais','apex-js-api.d.ts')});
 
            try{
                await vscode.workspace.openTextDocument(apiFileUri);
            }catch{
                if (applicationServer && imageDirectory){

                    if (applicationServer.includes('http')){
                        res = await httpc.get(applicationServer + (imageDirectory.endsWith('/') ? imageDirectory : imageDirectory + '/') + apiPath);
                    }else{
                        res = await  httpc.get('http://' + applicationServer + (imageDirectory.endsWith('/') ? imageDirectory : imageDirectory + '/') + apiPath);
                    }

                    if (res.message.statusCode===200){

                        let body = await res.readBody();
                        await vscode.workspace.fs.writeFile(apiFileUri, Buffer.from(body));
                        await vscode.workspace.openTextDocument(apiFileUri);

                    }else{
                        vscode.window.showErrorMessage(`ApexIntelliSense: Could not load APEX JS API from ${applicationServer} - most likely wrong path`);
                    }
                }
            }
        }catch(err){
            vscode.window.showErrorMessage(`ApexIntelliSense: Could not load APEX JS API from ${applicationServer} - connection problems`);
        }
    }

    public getLastUpdate():String{
        return this.objects.lastUpdate;
    }

    public setLastUpdate(updateDbTime:String){
        this.objects.lastUpdate = updateDbTime;
    }
}