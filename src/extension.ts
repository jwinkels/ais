// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as vscode from 'vscode';
import { DBObjects } from './DBObjects';
import { Cache } from './Cache';
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	async function loadItems(instantClientPath:string, connectionString:string, username:string, password:string, cache:Cache){	
		let items = await DBObjects.getPageItems(instantClientPath, connectionString, username, password);
			
		if (!items.error){
			for (let i=0; i<items.length; i++){
				cache.addItem(items[i].toString());
			}
			
		}else{
			vscode.window.showErrorMessage(items.error);
		}	
	}

	async function loadPackages(instantClientPath:string, connectionString:string, username:string, password:string, publicPackages:string, cache:Cache, progress:vscode.Progress<{message?: string | undefined; increment?: number | undefined;}>):Promise<any>{
		let packageList = publicPackages.split(',');
		publicPackages = "'" + packageList.join("','") + "'";
		
		let objects = await DBObjects.getPackages(instantClientPath, connectionString, username, password, publicPackages);
		let stepForward = 30 / objects.length;
		if (!objects.error){
			for(let i=0; i<objects.length; i++){
				progress.report({increment: stepForward, message: ' package - ' + objects[i][0].toString() + ' - 0%'});
				cache.addPackage(objects[i][0].toString(), objects[i][1]);
				await loadMethods(instantClientPath, connectionString, username, password, objects[i][0].toString(), objects[i][1], cache, progress);
			}
		}else{
			vscode.window.showErrorMessage(objects.error);
		}

	}

	async function loadApexPackages(instantClientPath:string, connectionString:string, username:string, password:string, cache:Cache, progress:vscode.Progress<{message?: string | undefined; increment?: number | undefined;}>){
		let objects 	= await DBObjects.getApexPackages(instantClientPath, connectionString, username, password);
		let stepForward = 50 / objects.length;
		if (!objects.error){
			for(let i=0; i<objects.length; i++){
				progress.report({increment: stepForward, message: ' package - ' + objects[i].toString() + ' - 0%'});
				cache.addPackage(objects[i].toString(),'');
				await loadMethods(instantClientPath, connectionString, username, password, objects[i].toString(), '' , cache, progress);
			}
		}
	}

	async function loadMethods(instantClientPath:string, connectionString:string, username:string, password:string, packageName:string|undefined, owner:string|undefined, cache:Cache, progress:vscode.Progress<{message?: string | undefined; increment?: number | undefined;}>){

		let methods:any;

		if (packageName){
			if (packageName.includes('apex_')){
				methods = await DBObjects.getApexPackageProcedures(instantClientPath, connectionString, username, password, packageName);
			}else{
				methods = await DBObjects.getPackageProcedures(instantClientPath, connectionString, username, password,  packageName, owner);
			}

			if (!methods.error){

				let ratio = 100/methods.length;

				for(let i=0; i<methods.length; i++){
					cache.addMethodToPackage(methods[i][0].toString(), methods[i][1], packageName, owner);
					await loadArguments(instantClientPath, connectionString, username, password, packageName, methods[i][0].toString(), methods[i][1], owner, cache);
					progress.report({increment: 0, message: ' package - ' + packageName + ' - '+(ratio*(i+1)).toFixed()+'%'});
				}
			}else{
				vscode.window.showErrorMessage(methods.error);
			}
		}else{
			methods = await DBObjects.getProcedures(instantClientPath, connectionString, username, password);
			if (!methods.error){
				for(let i=0; i<methods.length; i++){
					if (methods[i][2]){
						cache.addMethod(methods[i][0].toString(), methods[i][1], methods[i][2].toString());
					}else{
						cache.addMethod(methods[i][0].toString(), methods[i][1], undefined);
					}
					
					await loadArguments(instantClientPath, connectionString, username, password, undefined, methods[i][0].toString(), methods[i][1], methods[i][2], cache);
				}
			}else{
				vscode.window.showErrorMessage(methods.error);
			}
		}
	}

	async function loadArguments(instantClientPath:string, connectionString:string, username:string, password:string, packageName:string|undefined, methodName:string|undefined, id:number, owner:string|undefined, cache:Cache){
		
		let argumentList:any;
		try{
			argumentList = await DBObjects.getMethodArguments(instantClientPath, connectionString, username, password, packageName, methodName, id, owner);
			if (!argumentList.error){
				for(let i=0; i<argumentList.length; i++){
					if(argumentList[i][0]){
						cache.addArgumentToMethod(argumentList[i][0].toString(), argumentList[i][1].toString(), methodName, id, packageName, owner);
					}else{
						cache.addArgumentToMethod(undefined, argumentList[i][1].toString(), methodName, id, packageName, owner);
					}
				}
			}else{
				vscode.window.showErrorMessage(argumentList.error);
			}
		}catch(err){
			console.log(err);
		}
	}

	async function load(instantClientPath:string, connectionString:string, username:string, password:string, publicPackages:string){
		let cache:any 		= await new Cache().load();
		let apexCache:any	= await new Cache().loadApexPackages(undefined);
		let loadApex    	  = vscode.workspace.getConfiguration('').get('options.LoadApexPackages');

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Loading ",
			cancellable: true
		}, async (progress, token) => {
			progress.report({ increment: 0 , message: "Page Items..."});
			await loadItems(instantClientPath, connectionString, username, password, cache);
			
			progress.report({ increment: 10, message: "User Packages..." });
			await loadPackages(instantClientPath, connectionString, username, password, publicPackages, cache, progress);
			
			if(loadApex){
				progress.report({increment: 10, message: "User stored procedures..."});
				await loadMethods(instantClientPath, connectionString, username, password, undefined, username, cache, progress);

				cache.serialize();
				
				vscode.window.showInformationMessage('Loading APEX Packages  - this may take several minutes!');
				await loadApexPackages(instantClientPath, connectionString, username, password, apexCache, progress);
				
				vscode.workspace.getConfiguration('').update('options.LoadApexPackages', false, vscode.ConfigurationTarget.Workspace);
				apexCache.serializeApexPackages();
			}else{
				progress.report({increment: 50, message: "User stored procedures..."});
				await loadMethods(instantClientPath, connectionString, username, password, undefined, username, cache, progress);

				cache.serialize();	
			}
		});
		
	}

	const disposable = vscode.commands.registerCommand('ail.activate', async () => {

		let password:string;	
		let username =""+vscode.workspace.getConfiguration('',).get('credentials.username');
		let instantClientPath = "" + vscode.workspace.getConfiguration('').get('paths.OracleInstantClientPath');
		let connectionString  = "" + vscode.workspace.getConfiguration('').get('credentials.connection');
		let publicPackages    = "" + vscode.workspace.getConfiguration('').get('options.PublicPackages');
		let loadOnActivate    = vscode.workspace.getConfiguration('').get('options.LoadObjectsOnActivate');

		try{
			
			if (loadOnActivate){
				password = "" +  await vscode.window.showInputBox({password: true, prompt: `Password for ${username}`});
				let connection = await DBObjects.connectTo(instantClientPath, connectionString, username, password);

				if(connection.error){
					vscode.window.showErrorMessage(connection.error);
					deactivate();
					return undefined;
				}

				await load(instantClientPath, connectionString, username, password, publicPackages);
			}
			vscode.window.showInformationMessage('ApexIntelliSense is activated!');
		}catch(err){
			console.log(err);
		}
	});

	const updateChache = vscode.commands.registerCommand('ail.updateCache', async () => {
		let password:string|undefined;	
		let username =""+vscode.workspace.getConfiguration('').get('credentials.username');
		let instantClientPath = "" + vscode.workspace.getConfiguration('').get('paths.OracleInstantClientPath');
		let connectionString  = "" + vscode.workspace.getConfiguration('').get('credentials.connection');
		let publicPackages    = "" + vscode.workspace.getConfiguration('').get('options.PublicPackages');

		if(!context.secrets.get(username)){
			password = "" +  await vscode.window.showInputBox({password: true, prompt: `Password for ${username}`});
			context.secrets.store(username, password);
		}else{
			password = "" + await context.secrets.get(username);
		}

		await load(instantClientPath, connectionString, username, password, publicPackages);
		vscode.window.showInformationMessage('ApexIntelliSense Cache is updated!');
	});
	
	

	context.subscriptions.push(	disposable,
							   	updateChache,
								vscode.languages.registerCompletionItemProvider(
									['plaintext','sql','oracle'],
									new ApexCompletionItemProvider,
									'.'
								)
	);
}

// this method is called when your extension is deactivated
export function deactivate() {}



class  ApexCompletionItemProvider implements vscode.CompletionItemProvider{
	private documentWords: string[];

	constructor(){
		this.documentWords = [];
	}

	private replaceSpecialChars(line:string){
		const specialChars:string[]=['=','('];
		let replaced:string=line;
		for(let i=0; i<specialChars.length; i++){
			replaced=replaced.replace(specialChars[i],' ');
		}
		return replaced;
	}

	async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position,  token: vscode.CancellationToken, compContext: vscode.CompletionContext){
		let completionItems:vscode.CompletionItem[]=[];
		
		const linePrefix = document.lineAt(position).text.substr(0, position.character);
		
		
		if (!linePrefix.endsWith('.')) {
			await this.loadDocument(document);
			completionItems = completionItems.concat(await this.getApexItems());
			completionItems = completionItems.concat(await this.getSchemaPackages());
			completionItems = completionItems.concat(await this.getDocumentDefinitions());
		}else{
			completionItems = completionItems.concat(await this.getMethods(document, position));
		}
		return completionItems;
	}

	private async loadDocument(document: vscode.TextDocument){
		let regex: RegExp = new RegExp(/(\w+[\s|$])(?![\s\S]*\1)/,"gm");
		//let regex: RegExp = new RegExp(/(\w+)/g);
		
		const text = document.getText();
		let matches=text.match(/(\w+[\s|$])(?![\s\S]*\1)/g);
		this.documentWords=[];
		if(matches){
			for (let i=0; i<matches.length; i++){
				this.documentWords[i]=matches[i].replace(/(\r\n|\n|\r)/gm, "");;
			}
		}
	}

	private async getApexItems():Promise<vscode.CompletionItem[]> {
		let userObjectcache:Cache   = await new Cache().load();
		let cache:any				= userObjectcache.getCache();
		let items:any;
		let completionItems : vscode.CompletionItem[]=[];
	
		if (cache.items.length>0){
			items = cache.items;
		
			for (let i=0; i<items.length; i++){
				let item : vscode.CompletionItem = new vscode.CompletionItem(items[i].toString(), vscode.CompletionItemKind.Field);
				this.documentWords=this.documentWords.filter((value)=>value.toLocaleUpperCase()!==items[i].toString());
				item.insertText=items[i].toString();
				completionItems.push(item);
			}

			return completionItems;
		}else{
			return completionItems;
		}				
	}

	private async getSchemaPackages():Promise<vscode.CompletionItem[]> {
		let completionItems : vscode.CompletionItem[]=[];
		let apexCachePath:string|undefined 	= vscode.workspace.getConfiguration('').get('paths.ApexCacheFile');
		let userObjectcache:Cache   		= await new Cache().load();
		let apexObjectCache:Cache			= await new Cache().loadApexPackages(apexCachePath);
		let cache:any               		= userObjectcache.getCache();
		let apexCache:any		    		= apexObjectCache.getCache();


		let object : vscode.CompletionItem;
		for(let i=0; i<cache.packages.length; i++){
			
			if (cache.packages[i].owner){
				object = new vscode.CompletionItem(cache.packages[i].owner + '.'+ cache.packages[i].name);
				this.documentWords=this.documentWords.filter((value)=>value!==cache.packages[i].owner);
			}else{
				object = new vscode.CompletionItem(cache.packages[i].name);
			}
			this.documentWords=this.documentWords.filter((value)=>value!==cache.packages[i].name);
			object.commitCharacters = ['.'];
			object.documentation = new vscode.MarkdownString(`Press . to type ${cache.packages[i].name}`);
			completionItems.push(object);
		}
		
		for(let i=0; i<apexCache.packages.length; i++){
			
			if (apexCache.packages[i].owner){
				object = new vscode.CompletionItem(apexCache.packages[i].owner + '.'+ apexCache.packages[i].name);
				this.documentWords=this.documentWords.filter((value)=>value!==apexCache.packages[i].owner);
			}else{
				object = new vscode.CompletionItem(apexCache.packages[i].name);
			}
			this.documentWords=this.documentWords.filter((value)=>value!==apexCache.packages[i].name);
			object.commitCharacters = ['.'];
			object.documentation = new vscode.MarkdownString(`Press . to type ${apexCache.packages[i].name}`);
			completionItems.push(object);
		}

		//Standalone Methods/Stored Procedures/Functions
		let methods = Object.keys(cache.methods);
		
		if (methods.length>0){
			let object : vscode.CompletionItem;
			for (let i=0; i<methods.length; i++){
				if(cache.methods[methods[i]].owner){
					object  = new vscode.CompletionItem(cache.methods[methods[i]].owner + '.' + methods[i], vscode.CompletionItemKind.Function);
					this.documentWords=this.documentWords.filter((value)=>value!==cache.methods[methods[i]].owner);
				}else{
					object  = new vscode.CompletionItem(methods[i], vscode.CompletionItemKind.Function);
				}
				this.documentWords=this.documentWords.filter((value)=>value!==methods[i]);
				object.insertText = object.label;
				object = await this.argumentListSnippet(object, cache.methods[methods[i]].arguments);
				
				
				completionItems.push(object);
			}
		}

		return completionItems;
	}

	private async argumentListSnippet(object:vscode.CompletionItem, argumentList:any):Promise<vscode.CompletionItem>{
		let argumentNames = Object.keys(argumentList);
		let parameters = "( ";
		let details = "";
		let returnType = "";
		for (let i = 0; i<argumentNames.length; i++){
			if(argumentList[argumentNames[i]].return){
				returnType = argumentList[argumentNames[i]].type;
			}else{
				if( argumentList[argumentNames[i]].type==='varchar2'){
					parameters = parameters + '\n\t' + argumentNames[i] + ` =>'$${(i+1)}',`;
				}else{
					parameters = parameters + '\n\t' + argumentNames[i] + ' => $' + (i+1) + ',';
				}
				
				details = details + '\n\t' + argumentNames[i] + ' ' + argumentList[argumentNames[i]].type + ',';
			}
		}

		if(details.lastIndexOf(',')!==-1){
			details = details.substr(0, details.length-1);
		}

		if (parameters.lastIndexOf(',')!==-1){
			parameters = parameters.substr(0,parameters.length-1)+'\n);';
		}else{
			parameters="";
		}

		if (returnType){
			object.documentation = new vscode.MarkdownString().appendCodeblock('('+details+'\n) return '+returnType );
		}else{
			object.documentation = new vscode.MarkdownString().appendCodeblock('('+details+'\n)');
		}

		object.insertText = new vscode.SnippetString(object.insertText + parameters);

		return object;
	}

	async getMethods(document: vscode.TextDocument, position: vscode.Position):Promise<vscode.CompletionItem[]>{
		let completionItems:vscode.CompletionItem[]=[];
		let apexCachePath:string|undefined 	= vscode.workspace.getConfiguration('').get('paths.ApexCacheFile');		
		let userObjectcache:Cache   		= await new Cache().load();
		let apexObjectCache:Cache			= await new Cache().loadApexPackages(apexCachePath);
		let cache:any               		= userObjectcache.getCache();
		let apexCache:any		    		= apexObjectCache.getCache();
		let methods:any;
		let packageName="";
		let owner:string = "";
		let index:number=-1;
		const linePrefix = document.lineAt(position).text.substr(0, position.character);
		
		if (!linePrefix.endsWith('.')) {
			return completionItems;
		}

		const lineInSpaces = this.replaceSpecialChars(linePrefix).split(' ');
		const packageURI = lineInSpaces[lineInSpaces.length-1].split('.');

		if (packageURI.length>1){
			
			packageName = packageURI[packageURI.length-2].trim();
			owner 		= packageURI[0].trim();
			if (owner===packageName){
				owner='';
			}
		}else{
			packageName = linePrefix.substr(0,linePrefix.length-1).trim();
		}
		
		packageName = packageName.replace(/[^a-zA-Z0-9_]/g, " ");

		if (packageName.includes(' ')){
			packageName = packageName.substring(packageName.lastIndexOf(' '), packageName.length).trim();
		}

		index = cache.packages.findIndex((aPackage:{name:string, owner:string})=>aPackage.name === packageName && aPackage.owner === (owner?owner:null));
		
		if(index === -1){
			index = apexCache.packages.findIndex((aPackage:{name:string, owner:string})=>aPackage.name === packageName && aPackage.owner === owner);
			methods = apexCache.packages[index].methods;
		}else{
			methods = cache.packages[index].methods;
		}

		for (let i=0; i<methods.length; i++){
			let object : vscode.CompletionItem = new vscode.CompletionItem(methods[i].name, vscode.CompletionItemKind.Function);
			this.documentWords=this.documentWords.filter((value)=>value!==methods[i].name);
			object.insertText = object.label;
			object = await this.argumentListSnippet(object, methods[i].arguments);
			completionItems.push(object);
		}

		if (completionItems.length > 0){
			return completionItems;
		}else{
			return completionItems;
		}
	}

	async getDocumentDefinitions():Promise<vscode.CompletionItem[]> {
		let completionItems:vscode.CompletionItem[]=[];
		for (let i=0; i<this.documentWords.length; i++){
			completionItems.push(new vscode.CompletionItem(this.documentWords[i].toString(), vscode.CompletionItemKind.File));
		}
		return completionItems;
	}
}