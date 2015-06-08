define([
    "jwebkit",
    "jwebdesk",
    "./drive-acl",
    "./drive-aux"
], function(jwk, jwebdesk, ACLDrive, AUXDrive) {

    /*
    TODO: 
    - deberá correr en un iframe invisible siempre presente bajo un dominio diferente del top.location.href.
    

    */
    
    
    jwebdesk.DriveManager = function () {                
        jwk.Node.call(this);
        this.set("drives", new jwk.Node());
        var manager = this;
        manager._sessions  = new jwk.Node();
        manager._drives    = new jwk.Node();
        manager._rootnodes = new jwk.Node();
        manager._acls      = new jwk.Node();
        manager._current   = null;
        
        
        this.list_drivers().done(function (drivelist) {
            
            // Pre cargamos todos los drivers
            // manager._drivelist = lista;
            var packages = [];
            for (var name in drivelist) {
                var package_id = drivelist[name];
                packages.push(package_id);
            }            
            jwebdesk.repository.require(packages).done(function () {
                for (var i=0; i<arguments.length; i++) {
                    var drive = new arguments[i].module(null);
                    var root  = drive.get("root");
                    /*
                    root.getDrive = function () {
                        return manager.current();
                    }*/
                    manager._rootnodes.set(arguments[i].get("drive"), root);
                }      
                manager.create_service();
            });
        });        
    }
    
    jwebdesk.DriveManager.prototype = new jwk.Node();
    jwebdesk.DriveManager.prototype.constructor = jwebdesk.DriveManager;
    
    jwebdesk.DriveManager.prototype.current = function (drive) {        
        var manager = this;
        if (arguments.length == 1) {
            console.log("jwebdesk.DriveManager.current(" + drive.id() + ") Pretendiente", arguments);
            return jwk.mutex("jwebdesk-drive-manager-current").then(function (mutex) {
                console.log("jwebdesk.DriveManager.current(" + drive.id() + ") Obtiene mutex", arguments);
                console.assert(!manager._current, "ERROR: last current drive didn't resolve the mutex instance", [manager._current, drive]);
                manager._current = drive;
                console.log("manager._current = drive(" + drive.id() + "); ");
                mutex.done(function () {
                    console.log("jwebdesk.DriveManager.current(" + manager._current.id() + ") Release mutex");
                    manager._current = null;
                });
                return jwk.Deferred().resolve(mutex).promise();
            });
        } else {
            console.assert(manager._current, "ERROR: not current drive available");
            return manager._current;
        }
    }
    
    jwebdesk.DriveManager.prototype.print_debug = function () {
        var manager = this;
        console.error("jwebdesk.DriveManager.print()");
        manager._sessions.each(function (session, sesid, index){
            console.error(session.appid + "(" + session.apptoken + ")");
            for (var i in session.drives) {
                var drive = session.drives[i];                
                var root = drive.get("root");
                console.error("- ", drive.get("title"), root.toJSON());            
            }
        })
        return true;
    }
    
    jwebdesk.DriveManager.prototype.list_drivers = function (_options) {
        // tiene que hacer una consulta al servidor y devolver la lista completa de drives que se hayan registrado
        var deferred = jwk.Deferred();
        var manager = this;
        var options = _options || {};
        
        jwebdesk.repository.list({"prop":"type","equals":"drive"}).done(function (lista) {
            var _drivelist = {};
            
            for (package_id in lista) {
                package_json = lista[package_id];
                drive_name = package_json.drive;
                
                if (typeof options.acltoken != "undefined") {
                    if (typeof options.acltoken == "string") {
                        acl = manager._acls.get(options.acltoken);
                        if (acl.valueOf) acl = acl.valueOf();
                        if (acl && acl.drive && drive_name in acl.drive) {
                            _drivelist[drive_name] = package_id;
                        }
                        if (acl && acl.use == "owner" && drive_name in manager._sessions.get(acl.owner).drives) {
                            _drivelist[drive_name] = package_id;
                        }                        
                    }
                } else {
                    if (!options.no_oauth || !package_json.oauth) {
                        _drivelist[drive_name] = package_id;
                    }
                }
            } 
            
            manager.get("drives").map(_drivelist);
            deferred.resolve(_drivelist);
        });
        
        return deferred.promise();                
    }
    
    jwebdesk.DriveManager.prototype.show_dialog = function (session_id, params) {        
        // tiene que retornar el proxy id del drive indicado
        var deferred = jwk.Deferred();
        var manager = this;
        
        var session = this._sessions.get(session_id);
        console.assert(session, [this._sessions], arguments);
        
        this.create_acl_token(session_id, {use: "owner"}).then(function (acltoken) {
            return jwebdesk.open_app("opfolders-browser", jwk.extend(params, {apptoken: session.apptoken, acltoken: acltoken})).done(function (opfolders) {
                opfolders.___ = "opfolders";
                
                opfolders.one("select", function (n,e) {
                    deferred.resolve(e.selection);
                    opfolders.close();                    
                }, "Oppener");

                opfolders.one("save", function (n,e) {
                    deferred.resolve(e).promise();
                    opfolders.close();
                }, "Oppener");

                opfolders.one("cancel close", function () {
                    deferred.resolve([""]).promise();
                    opfolders.close();
                }, "Oppener");
            });            
        });      
        return deferred;
    }
    
    jwebdesk.DriveManager.prototype.create_acl_token = function (session_id, params) {        
        var token = jwk.uniqueId();
        var acl = new jwk.Node();
        console.log("create_acl_token: ", [session_id, params], "-> token: ", token);
        
        // tiene que retornar el proxy id del drive indicado 
        var manager = this;
        
        var session = this._sessions.get(session_id);
        console.assert(session, [this._sessions], arguments);
        
        acl.map(params);
        acl.set("owner", session_id);
        
        this._acls.set(token, acl);
        return jwk.Deferred().resolve(token).promise();
    }    
    
    jwebdesk.DriveManager.prototype.drive_proxy = function (session_id, drive_id, package_id) {        
        // tiene que retornar el proxy id del drive indicado
        var deferred = jwk.Deferred();
        var manager = this;
        
        var session = this._sessions.get(session_id);
        console.assert(session, [this._sessions], arguments);
        
        if (session.drives[drive_id]) {
            var proxy_id = session.drives[drive_id]._proxy._proxy_id;
            deferred.resolve(proxy_id);
        }
        
        return deferred.promise();                
    }    
    
    jwebdesk.DriveManager.prototype.getAppPackage = function (apptoken) {
        var deferred = jwk.Deferred();
        var url = jwebdesk.serverURL + "?action=apptoken&apptoken="+apptoken;
        $.getJSON(url).done(function(result) {            
            if (result.error) deferred.reject(result.error);
            if (result.package) deferred.resolve(result.package);
        }).fail(function (){
            deferred.reject(arguments);
        });
        return deferred.promise();
    }

    jwebdesk.DriveManager.prototype.session = function (apptoken, acltoken, drive_names) {
        /*
        TODO:
        - sacar el appid de la invocación para que no ande viajando en la jwk.net
          - jwebdesk.app.js: agregar el acltoken
        - implementar posta el getAppPackage pero que le pregunte al servidor cual es el ID de ese token y obtener el appid
          - este mismo archivo: funcion getAppPackage
          - 
        
        Ahora quiero que una aplicación pueda llamar a otra y que no le tenga que pasar el token.
        
        + el package del drive X debe indicar que parámetros componen las credenciales para acceder al mismo.
          Ej: DropBox: "key", github: [ "id", "secret"]
        + los drives de una aplicación deben calcularse teniendo en cuenta este nuevo dato
        + jwebdesk.DriveManager.prototype.session debe recibir un parámetro más que sea acltoken.
          Básicamente es un token (o una lista de) que extienden los permisos q tiene una app.
        + jwebdesk.DriveManager tiene que incluir una nueva función que sirva para generar un nuevo token al que se le pueden configurar las ACL
        + cuando una aplicaciḉon quiere llamar a otra en vez de pasar su proipio token deberá pasar el token generado
        + los permisos otorgados por el acltoken pisan los de la apptoken.
        + hay qye hacer la funcion proxy.change_id. Afecta a jwk.net.proxy y jwk.net.core
        - hay que crear un Drive que haga de pasamano entre el pedido de la App-B un un drive de la App-A (que fue la que abrio App-B).
          Este drive ase encarga de aplicar las ACL que recibe por parámetro en el constructor junto con la instancia del drive real de la seción de la App-A
          si este Drive está tapando un drive que la propia App-B ya tenía (ponele que le dieron permisos sobre "dropbox:/coso" y la App-B ya tenía dropbox)
          entonces tiene que recibirla como parámetro para poderla invocar cuando no se cumplan las ACLs.
        - Hay que crear un drive Temp que sirva para que una aplicación pueda crearse a si misma un Drive temporal.
          sería usado para intercambiar datos entre aplicaciones:
          Ej: App-A abre JSONLint-Pro y da permiso de escritura sobre un archivo en ese drive que tiene un json para editarlo.
        - En el paquewte del Wizard, en el botón "edit code" hacer un acltoken y levantar el bracketsonlinecon ese acltoken
        */
        
        
        // tiene que crear una sessión para la applicación invocante.           
        
        
        
        var deferred = jwk.Deferred();
        var manager = this;        
        var drivelist = manager.get("drives").valueOf();
// console.log("session", arguments);
        this.getAppPackage(apptoken).done(function (appid) {
            var session = null;
// console.log("this.getAppPackage()", arguments);
            manager._sessions.each(function (ses, id, index) {
                if (ses.appid == appid && ses.apptoken == apptoken) {
                    session = ses;
// console.log("encontre una session", session);
                    return true;
                } 
            })
            if (!session) {
                session = {
                    appid: appid,
                    apptoken: apptoken,
                    id: "drives-session-" +jwk.uniqueId(),
                    drives: {}                
                }
                
                var acl = acltoken;
                if (typeof acltoken == "string") acl = manager._acls.get(acltoken);
                var drives = manager._drives.get(appid);
                var owner_session = null;
                if (acl) {                    
                    console.log("This aplication was oppened by another aplication", acl);
                    owner_session = manager._sessions.get(acl.get("owner"));
                    console.assert(owner_session, [manager._sessions, acl]);
                    if (acl.get("use") == "owner") {
                        // this is used from any app when open_app("opfolders-browser")                        
                        drives = manager._drives.get(owner_session.appid);
                    }                  
                }
                
// console.log("creamos una NUEVA session", session);
                if (!drives) {
                    drives = new jwk.Node();
                    if (!acl) {
                        // esto es para no guardar un conjunto de drivers que en realidad hay uno de ellos que está afectado por la acl
                        // no queremos que en subsecuentes aperturas del mismo programa utilice esa misma restriccion acl
                        manager._drives.set(appid, drives);
                    }
// console.log("creamos una NUEVA instancia de drives", [drives], " para appid:", [appid]);                                
                }
                
                // console.log("drive_names", drive_names);
                
                for (var i in drive_names) {
                    var name = drive_names[i];
                    if (name in drivelist) {                    
                        var drive = drives.get(name);
                                                
                        if (acl && acl.get("drive") && acl.get("drive").get(name)) {
                            var owner_drive = owner_session.drives[name];
                            console.error("new ACLDrive("+name+")");
                            drive = new ACLDrive(owner_session.apptoken, acl.get("drive").get(name), owner_drive);
                            drive.manager = manager;
                            drive.create_proxy();                            
                            var root = manager._rootnodes.get(owner_drive.get("id"));
                            drive.set("root", root);
                            drive.flag_on("updated");
                            drives.set(name, drive);
                            session.drives[name] = drive;                            
                        }
                        
                        if (drive) {
                            session.drives[name] = drive;
                        } else {
                            var package_id = drivelist[name];

                            jwebdesk.repository.require(package_id).done(function (package) {                                
                                var drv = new package.module(apptoken);                                
                                drv.manager = manager;
                                drv.create_proxy();
                                console.assert(typeof drv.get("id") == "string", [drv.get("name")]);
                                console.assert(manager._rootnodes.get(drv.get("id")), [drv.get("id"), manager._rootnodes.get(drv.get("id"))]);
                                var root = manager._rootnodes.get(drv.get("id"));
                                drv.set("root", root);
                                drv.flag_on("updated");
                                (function(_drive, _root) {
                                    _root.on("change_data", function (n, e) {
                                        // console.error("_drive(" +_drive.___+")._proxy.trigger("+n+", ",[e],"); _drive._proxy: ", _drive._proxy._proxy_id);
                                        _drive._proxy.trigger(n, e);
                                    });
                                    _root.on("change_children", function (n, e) {
                                        // console.error("_drive(" +_drive.___+")._proxy.trigger("+n+", ",[e],"); _drive._proxy: ", _drive._proxy._proxy_id);
                                        _drive._proxy.trigger(n, e);
                                    });
                                })(drv, root);                                
                                drives.set(name, drv);
                                session.drives[name] = drv;
                                // console.log("creamos un NUEVO drv", [drv], " para name:", [name]);                                   
                            });
                        }
                        
                        
                        
                    }
                }
                
                manager._sessions.set(session.id, session, {no_parse: true});            
            }

            // console.error("DRIVE SESSION ", appid, apptoken, [session]);
            deferred.resolve(session.id);
        }).fail(function (err){
            deferred.reject(err);        
        });
        return deferred.promise();        
    }

    /*
    // funciona bien pero me equivoqué. Funcionaria si cargara algún servicio que tuviera que necesariamente
    // estar cargada en el top. Pero este caso es una biblioteca javascript. Así que debe cargarse local al iframe que lo necesita.
    jwebdesk.DriveManager.prototype.load = function (package_id) {
        var deferred = jwk.Deferred();
        
        if (typeof package_id == "object") {
            var all = [];
            for (var pack_id in package_id) {
                all.push(drive_manager.load(pack_id));
            }            
            return $.when.apply($, all);
        } else {
            jwebdesk.repository.require(package_id).done(function () {
                console.log("load drive", arguments);
                deferred.resolve();
            });
        }
        
        return deferred.promise();
    }*/

    jwebdesk.DriveManager.prototype.create_service = function () {
        var service = jwk.global.proxy();
        var manager = this;
        manager.service = service;
        
        service.register_function({
            print: manager.print_debug,
            list_drivers: manager.list_drivers,
            // load: manager.load,
            session: manager.session,
            drive_proxy: manager.drive_proxy,    
            create_acl_token: manager.create_acl_token,
            show_dialog: manager.show_dialog,    // levanta el opfolders
        }, this);
                
        jwebdesk.register_service("drive-manager", service);        
    }
    
    var need_iframe = false;
    // try { need_iframe = (window.top == window); } catch (e) {}
    need_iframe = need_iframe || (window.location.origin != jwebdesk.baseURL);
    
    if (!need_iframe) {
        // console.log("--->", window.location.href);
        var drive_manager = new jwebdesk.DriveManager();
    } else {
        var src = jwebdesk.serverURL + "?package=jwebdesk-drive-manager";
        // console.log(" Hago el iframe", src);
        $("body").append($("<iframe src='"+src+"'></iframe>").css({width:"0", height:"0"}));
    }
    
    return drive_manager;
});