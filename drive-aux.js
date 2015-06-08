define([
    "jwebkit",
    "jwebdesk"
], function(jwk, jwebdesk) {
    
    function AUXDrive () {
        jwk.Node.call(this);
    }

    AUXDrive.prototype = new jwebdesk.Drive();
    AUXDrive.prototype.constructor = AUXDrive;
    
    
    // -------------------------------------------------------------------------------------------

    AUXDrive.prototype.assert_acls = function (node) {
        
        return jwk.Deferred().resolve(self, this._owner).promise();
    }
    
    AUXDrive.prototype.login = function (do_popup) {}      
    
    AUXDrive.prototype.logout = function () { }
    
    AUXDrive.prototype.user = function () {}

    AUXDrive.prototype.root = function () {}

    AUXDrive.prototype.writeFile = function (node, data, params) {
        return this.assert_acls(node).then(function (self, drive){
            return drive.writeFile(node, data, params);
        });
    }
    
    AUXDrive.prototype.readFile = function (node) {
        return this.assert_acls(node).then(function (self, drive){
            return drive.readFile(node);
        });
    }
    
    AUXDrive.prototype.readdir = function (node) {
        return this.assert_acls(node).then(function (self, drive){
            return drive.readdir(node);
        });
    }

    AUXDrive.prototype.createChild = function (node, entry) {
        return this.assert_acls(node).then(function (self, drive){
            return drive.createChild(node, entry);
        });
    }

    AUXDrive.prototype.link = function (node) {
        return this.assert_acls(node).then(function (self, drive){
            return drive.link(node);
        });
    }
    
    AUXDrive.prototype.thumbnail = function () {
        return this.assert_acls(node).then(function (self, drive){
            return drive.thumbnail(node);
        });
    }
    
    return AUXDrive;
});