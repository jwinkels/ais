import * as ORACLEDB from 'oracledb';

export interface IConnectionProperties {
    user: string,
    password: string,
    connectString: string,
    privilege?: any
  }
  

export class DBObjects {

    static connection:any;

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

    public static async getPackages(clientPath:string|undefined, connectionString:string|undefined, username:string|undefined, password:string|undefined, publicPackages:string|undefined):Promise<any>{
        this.connection =  await this.connectTo(clientPath, connectionString, username, password);

        if (!this.connection.error){
            
            let query = `select lower(object_name) package_name, '' owner
                          from user_objects where object_type = 'PACKAGE'
                          union
                        select lower(table_name) granted_package_name,  lower(grantor)
                          from user_tab_privs privs
                          where privs.owner != 'SYS'
                          and privs.type ='PACKAGE'
                          union
                        select lower(all_syn.synonym_name), lower(all_obj.owner)
                          from all_synonyms all_syn join all_objects all_obj on (all_syn.table_name=all_obj.object_name and all_syn.table_owner=all_obj.owner)
                          where all_syn.synonym_name in(${publicPackages})
                          and all_obj.object_type = 'PACKAGE'`;
            try{
                let result = await this.connection.execute(query);
                return result.rows;
            }catch(err){
                return {error: "Could not get user-packages!"};
            };
        }else{
            return {error: this.connection.error};
        }
    }

    public static async getPackageProcedures(clientPath:string|undefined, connectionString:string|undefined, username:string|undefined, password:string|undefined, packageName:string|undefined, owner:string|undefined):Promise<any>{
        this.connection =  await this.connectTo(clientPath, connectionString, username, password);

        if (!this.connection.error){
            let query='';
            if (owner){
                query = `select lower(all_proc.procedure_name),  
                                    all_proc.subprogram_id
                               from all_procedures all_proc 
                                where lower(all_proc.object_name) = '${packageName}'
                                and all_proc.procedure_name is not null
                                and (owner=user or lower(owner)='${owner}') 
                                order by all_proc.subprogram_id`;
            }else{
                query = `select lower(all_proc.procedure_name),  
                                        all_proc.subprogram_id
                                from all_procedures all_proc 
                                    where lower(all_proc.object_name) = '${packageName}'
                                    and all_proc.procedure_name is not null 
                                    order by all_proc.subprogram_id`;
            }
            try{
                let result = await this.connection.execute(query);
                return result.rows;
            }catch(err){
                return {error: "Could not get Package-Procedures!"};
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
                            where lower(all_syn.synonym_name) = '${packageName}'
                            and all_obj.object_type = 'PACKAGE'        
                            and procedure_name is not null`;
            
            try{
                let result = await this.connection.execute(query);
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
            if (packageName){
                if(packageName.startsWith('apex_')){
                    query= `with wwv_flow_name as(
                                select table_name package_name
                                from all_synonyms
                                where lower(synonym_name)='${packageName}'
                            )
                            select lower(argument_name), lower(data_type)
                            from all_arguments join wwv_flow_name on (all_arguments.package_name=wwv_flow_name.package_name)
                            and lower(object_name)='${methodName}'
                            and subprogram_id=${id}`;
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
                                where lower(package_name) = '${packageName}'
                                and lower(object_name)='${methodName}'
                                and subprogram_id=${id}`;
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
                            and lower(object_name)='${methodName}'
                            and subprogram_id=${id}
                            and (owner=user or lower(owner)='${owner}')`;
            }
            try{
                let result = await this.connection.execute(query);
                return result.rows;
            }catch(err){
                return {error: `Could not get Arguments for Method: ${methodName} (Package: ${packageName})`};
            };
        }else{
            return {error: this.connection.error};
        }
    }
}