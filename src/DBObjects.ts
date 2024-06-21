import * as ORACLEDB from 'oracledb';
import { stringify } from 'yaml';
import { Cache } from './Cache';

export interface IConnectionProperties {
    user: string,
    password: string,
    connectString: string,
    privilege?: any
  }
  

export class DBObjects {

    static connection:any;
    static apexVersion:number;
    static apexMinorVersion:string;

    public static async connectTo(clientPath:string|undefined, connectionString:string|undefined, username:string|undefined, password:string|undefined):Promise<any>{
        if (clientPath && clientPath !== ""){

            let conn:IConnectionProperties = {
                user: "" + username,
                password: "" + password,
                connectString: "" + connectionString,
                privilege: undefined
            };
            
            if(!this.connection){
                try{
                    try{
                        ORACLEDB.initOracleClient({libDir: clientPath});
                    }
                    catch(err){};

                return await ORACLEDB.getConnection(conn);
        
                }catch(err){
                    console.log(err);
                    if(this.connection){
                        await this.connection.close();
                    }
                    return {error:"Conncetion failed: "+ err};
                }
            }else{
                return this.connection;
            }
           
        }

        return undefined;
    }

    public static async getApexVersion(clientPath:string|undefined, connectionString:string|undefined, username:string|undefined, password:string|undefined):Promise<any>{
        this.connection = await this.connectTo(clientPath, connectionString, username, password);
        if (!this.connection.error){
            let query ="select version_no from apex_release";
            try{
                let version = await this.connection.execute(query);
                let versionString:string = version.rows[0][0];
                let firstDot:number = versionString.indexOf('.');
                this.apexVersion = Number.parseInt(versionString.substr(0, firstDot));
                firstDot = firstDot + 1;
                this.apexMinorVersion = versionString.substr(firstDot, versionString.indexOf('.', firstDot) - firstDot);
                return {version: this.apexVersion, fullVersion: version.rows[0][0]};
            }catch(err){
                return {error: "Your APEX Version is unfortunately outdated and not compatible"};
            }
        }else{
            console.log("Failed to connect!");
        }
    }

    public static async getPageItems(clientPath:string|undefined, connectionString:string|undefined, username:string|undefined, password:string|undefined):Promise<any>{
        this.connection =  await this.connectTo(clientPath, connectionString, username, password);

        if (!this.connection.error){
            let query = `select upper(item_name) ITEM_NAME 
                            from APEX_APPLICATION_PAGE_ITEMS
                            union
                        select upper(item_name) ITEM_NAME
                            from APEX_APPLICATION_ITEMS`;
            try{
                let result = await this.connection.execute(query);
                return result.rows;
            }catch(err){
                return {error: "Could not get APEX Items"};
            };
        }else{
            return {error: this.connection.errors};
        }
    }

    public static async getPackages(clientPath:string|undefined, connectionString:string|undefined, username:string|undefined, password:string|undefined, publicPackages:Array<string>|undefined, cache:Cache):Promise<any>{
        this.connection =  await this.connectTo(clientPath, connectionString, username, password);

        if (!this.connection.error){
            
            const lastUpdate = cache.getLastUpdate() ? cache.getLastUpdate() : null;

            let query = `select lower(object_name) package_name, '' owner, 'OWNED'
                          from user_objects 
                          where object_type = 'PACKAGE'
                          and ( :last_update is null or last_ddl_time > to_date(:last_update, 'DD.MM.YYYY HH24:MI:SS'))
                          union
                        select lower(table_name) granted_package_name,  lower(grantor), 'GRANTED'
                          from user_tab_privs privs join all_objects all_obj on (privs.owner=all_obj.owner and privs.table_name=all_obj.object_name)
                          where privs.owner != 'SYS'
                          and privs.type ='PACKAGE'
                          union
                        select lower(all_syn.synonym_name), lower(all_obj.owner), 'PUBLIC'
                          from all_synonyms all_syn join all_objects all_obj on (all_syn.table_name=all_obj.object_name and all_syn.table_owner=all_obj.owner)
                          where all_syn.synonym_name in(select * from TABLE(:packages))
                          and all_obj.object_type = 'PACKAGE'`;
            try{
                // eslint-disable-next-line @typescript-eslint/naming-convention
                let result = await this.connection.execute(query, {last_update: lastUpdate, packages:{type: "SYS.ODCIVARCHAR2LIST", val: publicPackages}});
                return result.rows;
            }catch(err){
                return {error: "Could not get user-packages! LastUpdate: " + lastUpdate  + err};
            };
        }else{
            return {error: this.connection.error};
        }
    }

    public static async getPackageProcedures(clientPath:string|undefined, connectionString:string|undefined, username:string|undefined, password:string|undefined, packageName:string|undefined, owner:string|undefined):Promise<any>{
        this.connection =  await this.connectTo(clientPath, connectionString, username, password);

        if (!this.connection.error){
            const query = `select lower(all_proc.procedure_name),  
                                all_proc.subprogram_id
                            from all_procedures all_proc 
                            where lower(all_proc.object_name) = :package_name
                            and all_proc.procedure_name is not null
                            and (owner=user or lower(owner)=:owner_name) 
                            order by all_proc.subprogram_id`;
            try{
                // eslint-disable-next-line @typescript-eslint/naming-convention
                let result = await this.connection.execute(query, {owner_name: owner, package_name: packageName});
                return result.rows;
            }catch(err){
                return {error: "Could not get Package-Procedures!"};
            };
        }else{
            return {error: this.connection.error};
        }
    }

    public static async getPackageVariables(clientPath:string|undefined, connectionString:string|undefined, username:string|undefined, password:string|undefined, packageName:string|undefined, owner:string|undefined):Promise<any>{
        this.connection =  await this.connectTo(clientPath, connectionString, username, password);
        if (!this.connection.error){
            let query = `with variables as(
                                    select name as variable_name, object_name as package_name, object_type, line
                                        from all_identifiers a
                                        where usage_context_id = 1
                                        and usage = 'DECLARATION'
                                        and type in ('CONSTANT', 'VARIABLE')
                                        and lower(object_name) = :package_name
                                        and (declared_owner=user or lower(declared_owner) = :owner_name)
                                        and object_type = 'PACKAGE'
                                    )
                select distinct variable_name,  trim(replace(substr(text, instr(text,'=')+1, (length(text)-instr(text, '='))-2), '''','')) value
                        from variables join all_source on (package_name=all_source.name)
                        and all_source.type = 'PACKAGE'
                        and (owner = user or lower(owner) = :owner_name)
                        and variables.line = all_source.line
                `;
            try{
                // eslint-disable-next-line @typescript-eslint/naming-convention
                let result = await this.connection.execute(query, {package_name: packageName, owner_name: owner});
                return result.rows;
            }catch(err){
                return {error: "Could not get variables! " + err};
            };
        }else{
            return {error: this.connection.error};
        }
    }

    public static async getProcedures(clientPath:string|undefined, connectionString:string|undefined, username:string|undefined, password:string|undefined):Promise<any>{
        this.connection =  await this.connectTo(clientPath, connectionString, username, password);

        if (!this.connection.error){
            let query = `select lower(us_proc.object_name), 
                                 us_proc.subprogram_id,
                                 '' grantor
                            from 
                                user_procedures us_proc 
                            where object_type!='PACKAGE'
                            union
                            select lower(table_name) procedure_name,
                                   subprogram_id, 
                                   lower(grantor)
                            from 
                                    user_tab_privs privs  join all_procedures on(object_name=table_name)
                            where privs.owner != 'SYS'
                            and privs.owner   != user
                            and privs.type not in ('PACKAGE', 'VIEW')
                         `;
            try{
                let result = await this.connection.execute(query);
                return result.rows;
            }catch(err){
                return {error: "Could not get user-procedures!"};
            };
        }else{
            return {error: this.connection.error};
        }
    }

    public static async getApexPackages(clientPath:string|undefined, connectionString:string|undefined, username:string|undefined, password:string|undefined):Promise<any>{
        this.connection =  await this.connectTo(clientPath, connectionString, username, password);

        if (!this.connection.error){
            
            let query = `select distinct lower(all_syn.synonym_name)
                            from all_synonyms all_syn join all_objects all_obj on (all_syn.table_name=all_obj.object_name)
                            where all_syn.synonym_name like 'APEX_%'
                            and all_obj.object_type = 'PACKAGE'
                            order by lower(synonym_name)`;
            
            try{
                let result = await this.connection.execute(query);
                return result.rows;
            }catch(err){
                return {error: "Could not get APEX-Packages"};
            };
        }else{
            return {error: this.connection.error};
        }
    }

    public static async getApexPackageProcedures(clientPath:string|undefined, connectionString:string|undefined, username:string|undefined, password:string|undefined, packageName:string|undefined):Promise<any>{
        this.connection =  await this.connectTo(clientPath, connectionString, username, password);

        if (!this.connection.error){
            
            let query = `select lower(all_proc.procedure_name), all_proc.subprogram_id
                            from all_synonyms all_syn join all_objects all_obj on (all_syn.table_name=all_obj.object_name)
                                                        join all_procedures all_proc on (all_proc.object_name=all_obj.object_name)
                            where lower(all_syn.synonym_name) = :package_name
                            and all_obj.object_type = 'PACKAGE'        
                            and procedure_name is not null`;
            
            try{
                // eslint-disable-next-line @typescript-eslint/naming-convention
                let result = await this.connection.execute(query, {package_name: packageName});
                return result.rows;
            }catch(err){
                return {error: "Could not get APEX-Package-Procedures"};
            };
        }else{
            return {error: this.connection.error};
        }
    }

    public static async getMethodArguments(clientPath:string|undefined, connectionString:string|undefined, username:string|undefined, password:string|undefined, packageName:string|undefined, methodName:string|undefined, id:number, owner:string|undefined):Promise<any>{
        this.connection =  await this.connectTo(clientPath, connectionString, username, password);

        if (!this.connection.error){
            let query ="";
            let binds = {};
            if (packageName){
                if(packageName.startsWith('apex_')){
                    query= `with wwv_flow_name as(
                                select table_name package_name
                                from all_synonyms
                                where lower(synonym_name)=:package_name
                            )
                            select lower(argument_name), lower(data_type)
                            from all_arguments join wwv_flow_name on (all_arguments.package_name=wwv_flow_name.package_name)
                            and lower(object_name)=:method_name
                            and subprogram_id=:id`;
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    binds = {id: id, method_name: methodName, package_name: packageName};
                }else{
                    query = `select lower(argument_name), 
                                    case 
                                        when type_name is not null and (type_owner!=user and type_owner!='PUBLIC') then
                                            lower(type_owner)||'.'||
                                            lower(type_name)||
                                            nvl2(pls_type,'%'||
                                            lower(pls_type),'')||
                                            nvl2(type_subname,'.'||lower(type_subname),'')
                                        when type_name is not null then
                                            lower(type_name)||
                                            nvl2(pls_type,'%'||lower(pls_type),'')||
                                            nvl2(type_subname,'.'||lower(type_subname),'')
                                        else
                                            lower(pls_type)
                                    end data_type
                                from all_arguments
                                where lower(package_name) = :package_name
                                and lower(object_name)= :method_name
                                and subprogram_id=:id`;
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    binds = {id: id, method_name: methodName, package_name: packageName};                                
                }
            }else{
                query = `select lower(argument_name),
                                case 
                                    when type_name is not null and (type_owner!=user and type_owner!='PUBLIC') then
                                        lower(type_owner)||'.'||
                                        lower(type_name)||
                                        nvl2(pls_type,'%'||
                                        lower(pls_type),'')||
                                        nvl2(type_subname,'.'||lower(type_subname),'')
                                    when type_name is not null then
                                        lower(type_name)||
                                        nvl2(pls_type,'%'||lower(pls_type),'')||
                                        nvl2(type_subname,'.'||lower(type_subname),'')
                                    else
                                        lower(pls_type)
                                end data_type
                            from all_arguments
                            where package_name is null
                            and lower(object_name)= :method_name
                            and subprogram_id = :id
                            and (owner=user or lower(owner) = :owner_name)`;
                // eslint-disable-next-line @typescript-eslint/naming-convention
                binds = {id: id, method_name: methodName, owner_name: owner};  
            }
            try{
                let result = await this.connection.execute(query, binds);
                return result.rows;
            }catch(err){
                return {error: `Could not get Arguments for Method: ${methodName} (Package: ${packageName})`};
            };
        }else{
            return {error: this.connection.error};
        }
    }


    public static async getDatabaseTime(clientPath:string|undefined, connectionString:string|undefined, username:string|undefined, password:string|undefined):Promise<any>{
        this.connection =  await this.connectTo(clientPath, connectionString, username, password);
        const query     = `select to_char(sysdate, 'DD.MM.YYYY HH24:MI:SS') from dual`;
        if(!this.connection.error){
            try{
                let result = await this.connection.execute(query);
                return result.rows[0].toString();
            }catch(err){
                return {error: `Could not determine databases current timestamp`};
            }
        }else{
            return {error: this.connection.error};
        }
    }
}