define([
    "jwebkit",
    "jwebdesk"
], function(jwk, jwebdesk) {
    
    function ACLDrive (apptoken, acl, owner) {
        this._owner = owner;
        this._acl = acl;
        jwebdesk.Drive.call(this, apptoken, {
            title: "ACLDrive",
            id: owner.get("id")
        });
    }

    ACLDrive.prototype = new jwebdesk.Drive();
    ACLDrive.prototype.constructor = ACLDrive;
    
    
    // -------------------------------------------------------------------------------------------

    ACLDrive.prototype.assert_acls = function (node, access) {
        var path = node.path;
        console.error("ACLDrive.prototype.assert_acls--->", node, this._acl);        
        return jwk.Deferred().resolve(self, this._owner).promise();
    }
    
    ACLDrive.prototype.login = function (do_popup) {}      
    
    ACLDrive.prototype.logout = function () { }
    
    ACLDrive.prototype.user = function () {}

    ACLDrive.prototype.root = function () {}

    ACLDrive.prototype.writeFile = function (node, data, params) {
        return this.assert_acls(node, "w").then(function (self, drive){
            return drive.writeFile(node, data, params);
        });
    }
    
    ACLDrive.prototype.readFile = function (node) {
        return this.assert_acls(node, "r").then(function (self, drive){
            return drive.readFile(node);
        });
    }
    
    ACLDrive.prototype.readdir = function (node) {
        return this.assert_acls(node, "r").then(function (self, drive){
            return drive.readdir(node);
        });
    }

    ACLDrive.prototype.createChild = function (node, entry) {
        return this.assert_acls(node, "w").then(function (self, drive){
            return drive.createChild(node, entry);
        });
    }

    ACLDrive.prototype.link = function (node) {
        return this.assert_acls(node, "r").then(function (self, drive){
            return drive.link(node);
        });
    }
    
    ACLDrive.prototype.thumbnail = function () {
        return this.assert_acls(node, "r").then(function (self, drive){
            return drive.thumbnail(node);
        });
    }
    
    return ACLDrive;
});