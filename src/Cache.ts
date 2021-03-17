
import * as yaml from "yaml";
const fs = require('fs');
import * as vscode from 'vscode';
import { posix } from 'path';

export class Cache{

    private objects:any= {
        items: [],
        packages: {},
        methods: {}
    };

    private argument={
        name:"",
        type:"",
        return:false
    };

    public getCache():any{
        return this.objects;
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

    public addPackage(name:string|undefined, owner:string):any{

        let cache = this.objects;
        if(name && !cache.packages[name]){
            cache.packages[name]={};
            if(owner!==''){
                cache.packages[name].owner=owner;
            }
            cache.packages[name].methods=[];
        }
    }

    public addMethod(methodName:string|undefined, methodId:number|undefined, owner:string|undefined){
        try{
            let cache = this.objects;
            if(methodName){     
                if (!cache.methods[methodName]){ 
                    cache.methods[methodName]={};
                    cache.methods[methodName].id=methodId;
                    cache.methods[methodName].owner=owner;
                    cache.methods[methodName].arguments={};
                }
            } 
            
            return cache;   
        }catch(err){
            console.log(err);
        }
    }

    public addMethodToPackage(methodName:string|undefined, methodId:number|undefined, packageName:string|undefined){

        let cache = this.objects;

        if(methodName 
                && packageName 
                && methodId
                && cache.packages[packageName]
            ){    
            if (cache.packages[packageName].methods.filter((aMethod: 
                                                               {name:string; id:number})=>
                                                               aMethod.name===methodName && 
                                                               aMethod.id===methodId
                                                            ).length===0
                
            ){
                cache.packages[packageName].methods.push({name: methodName, id: methodId, arguments: {}});
            }
        }  
    }

    public addArgumentToMethod(argumentName:string|undefined, type:string|undefined, methodName:string|undefined, methodId:number, packageName:string|undefined){
        
        if (argumentName){
            this.argument.name ="" + argumentName;
        }else{
            this.argument.name ="RETURN";
        }
        
        
        
        if(type 
                && methodName 
                && packageName
                //&& this.objects.packages[packageName].methods.length
                ){
            let index = this.objects.packages[packageName].methods.findIndex((aMethod:{name:string; id:number})=>aMethod.name===methodName && aMethod.id===methodId);
            if (index >= 0){
                this.objects.packages[packageName].methods[index].arguments[this.argument.name]={};
                this.objects.packages[packageName].methods[index].arguments[this.argument.name].type = type;
                
                if (!argumentName){
                    this.objects.packages[packageName].methods[index].arguments[this.argument.name].return = true;
                }
            }else{
                console.log('Method not found!');
            }
        }else if (type 
                    && methodName 
                    && this.objects.methods[methodName]){
            
            if (!this.objects.methods[methodName].arguments[ this.argument.name ]){

                this.objects.methods[methodName].arguments[ this.argument.name ]={};
                this.objects.methods[methodName].arguments[ this.argument.name ].type = type;

                if (!argumentName){
                    this.objects.methods[methodName].arguments[ this.argument.name ].return = true;
                }

            }
        }
    }

    public async load():Promise<any>{
        //const folderUri = vscode.workspace.workspaceFolders.;
        
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
}