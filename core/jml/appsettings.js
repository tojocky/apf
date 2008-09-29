/*
 * See the NOTICE file distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation; either version 2.1 of
 * the License, or (at your option) any later version.
 *
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this software; if not, write to the Free
 * Software Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 * 02110-1301 USA, or see the FSF site: http://www.fsf.org.
 *
 */

/**
 *
 * @addnode global:appsettings
 */
jpf.appsettings = {
    tagName            : "appsettings",
    
    //Defaults
    disableRightClick  : false,
    allowSelect        : false,
    autoDisableActions : false,
    autoDisable        : true,
    disableF5          : true,
    autoHideLoading    : true,
    disableSpace       : true,
    disableBackspace   : true,
    useUndoKeys        : false,
    
    tags               : {},
    defaults           : {},
    
    init : function(){
        if (jpf.isParsingPartial) {
            this.disableRightClick  = false;
            this.allowSelect        = true;
            this.autoDisableActions = false;
            this.autoDisable        = true;
            this.disableF5          = false;
            this.autoHideLoading    = true;
            this.disableSpace       = false;
            this.disableBackspace   = false;
            this.useUndoKeys        = false;
        }
    },
    
    getDefault : function(type, prop){
        var d = this.defaults[type];
        if (!d)
            return;
        
        for (var i = d.length - 1; i >= 0; i--) {
            if (d[i][0] == prop)
                return d[i][1];
        }
    },
    
    loadJml: function(x, parentNode){
        this.jml = x;
        
        //#ifdef __WITH_DOM_COMPLETE
        this.parentNode = parentNode;
        jpf.inherit.call(this, jpf.JmlDom); /** @inherits jpf.JmlDom */
        //#endif
        
        //Set Globals
        jpf.debug = jpf.isTrue(x.getAttribute("debug"));
        if (x.getAttribute("debug-type")) 
            jpf.debugType = x.getAttribute("debug-type");

        var nodes = x.attributes;
        for (var i = 0, l = nodes.length; i < l; i++) {
            this.tags[nodes[i].nodeName] = nodes[i].nodeValue;
        }

        jpf.debugFilter = jpf.isTrue(x.getAttribute("debug-teleport")) ? "" : "!teleport";
        
        if (jpf.debug) {
            jpf.addEventListener("load", function(){
                setTimeout("jpf.debugwin.activate();", 200) //@todo has a bug in gecko, chrome
            });
        }
        
        this.name               = x.getAttribute("name") 
            || window.location.href.replace(/[^0-9A-Za-z_]/g, "_");

        this.disableRightClick  = jpf.isTrue(x.getAttribute("disable-right-click"));
        this.allowSelect        = jpf.isTrue(x.getAttribute("allow-select"));
        
        this.autoDisableActions = jpf.isTrue(x.getAttribute("auto-disable-actions"));
        this.autoDisable        = !jpf.isFalse(x.getAttribute("auto-disable"));
        this.disableF5          = jpf.isTrue(x.getAttribute("disable-f5"));
        this.autoHideLoading    = !jpf.isFalse(x.getAttribute("auto-hide-loading"));
        
        this.disableSpace       = !jpf.isFalse(x.getAttribute("disable-space"));
        this.disableBackspace   = jpf.isTrue(x.getAttribute("disable-backspace"));
        this.useUndoKeys        = jpf.isTrue(x.getAttribute("use-undo-keys"));
        
        //#ifdef __DESKRUN
        if (jpf.isDeskrun && this.disableF5) 
            shell.norefresh = true;
        //#endif
        
        //Application features
        this.layout  = x.getAttribute("layout") || null;
        
        //#ifdef __WITH_STORAGE
        this.storage = x.getAttribute("storage") || null;
        if (this.storage)
            jpf.storage.init(this.storage);
        //#endif
        
        //#ifdef __WITH_OFFLINE
        this.offline = x.getAttribute("offline");
        if (this.offline)
            jpf.offline.init(this.offline);
        //#endif
        
        //#ifdef __WITH_AUTH
        if (x.getAttribute("login"))
            jpf.auth.init(x);
        //#endif

        var oFor, attr, d, j, i, l, node, nodes = x.childNodes;
        for (i = 0, l = nodes.length; i < l; i++) {
            node = nodes[i];
            if (node.nodeType != 1)
                continue;
            
            var tagName = node[jpf.TAGNAME];
            switch(tagName){
                //#ifdef __WITH_AUTH
                case "auth":
                case "authentication":
                    this.auth = node;
                    jpf.auth.init(node);
                    break;
                //#endif
                //#ifdef __WITH_OFFLINE
                case "offline":
                    this.offline = node;
                    jpf.offline.init(node);
                    break;
                //#endif
                //#ifdef __WITH_APP_DEFAULTS
                case "defaults":
                    oFor = node.getAttribute("for");
                    attr = node.attributes;
                    d = this.defaults[oFor] = [];
                    for (j = attr.length - 1; j >= 0; j--)
                        d.push([attr[j].nodeName, attr[j].nodeValue]);
                    break;
                //#endif
                default:
                    break;
            }
        }
        
        return this;
    }
};

//#ifdef __WITH_SETTINGS

/**
 * @constructor
 */
jpf.settings = function(){
    jpf.register(this, "settings", jpf.NOGUI_NODE);/** @inherits jpf.Class */
    var oSettings = this;
    
    /* ********************************************************************
     PROPERTIES
     *********************************************************************/
    this.inherit(jpf.DataBinding); /** @inherits jpf.DataBinding */
    /* ********************************************************************
     PUBLIC METHODS
     *********************************************************************/
    this.getSetting = function(name){
        return this[name];
    };
    
    this.setSetting = function(name, value){
        this.setProperty(name, value);
    };
    
    this.isChanged = function(name){
        if (!savePoint) 
            return true;
        return this.getSettingsNode(savePoint, name) != this[name];
    };
    
    this.exportSettings = function(instruction){
        if (!this.XmlRoot) 
            return;
        
        jpf.saveData(instruction, this.XmlRoot, null, function(data, state, extra){
            if (state != jpf.SUCCESS) {
                var oError;
                
                //#ifdef __DEBUG
                oError = new Error(jpf.formatErrorString(0, 
                    oSettings, "Saving settings", 
                    "Error saving settings: " + extra.message));
                //#endif
                
                if (extra.tpModule.retryTimeout(extra, state, null, oError) === true)
                    return true;
                
                throw oError;
            }
        });
        
        this.savePoint();
    };
    
    this.importSettings = function(instruction, def_instruction){
        jpf.getData(instruction, null, null, function(xmlData, state, extra){
            if (state != jpf.SUCCESS) {
                var oError;
                
                //#ifdef __DEBUG
                oError = new Error(jpf.formatErrorString(0, oSettings, 
                    "Loading settings", 
                    "Error loading settings: " + extra.message));
                //#endif
                
                if (extra.tpModule.retryTimeout(extra, state, this, oError) === true)
                    return true;
                
                throw oError;
            }
            
            if (!xmlData && def_instruction) 
                oSettings.importSettings(def_instruction);
            else 
                oSettings.load(xmlData);
        });
    };
    
    var savePoint;
    this.savePoint = function(){
        savePoint = jpf.xmldb.copyNode(this.XmlRoot);
    };
    
    //Databinding
    this.smartBinding = true;//Hack to ensure that data is loaded, event without smartbinding
    this.$load = function(XMLRoot){
        jpf.xmldb.addNodeListener(XMLRoot, this);
        
        for (var prop in settings) {
            this.setProperty(prop, null); //Maybe this should be !and-ed
            delete this[prop];
            delete settings[prop];
        }
        
        var nodes = this.XmlRoot.selectNodes(this.traverseRule || "node()[text()]");
        for (var i = 0; i < nodes.length; i++) {
            this.setProperty(this.applyRuleSetOnNode("name", nodes[i])
                || nodes[i].tagName, this.applyRuleSetOnNode("value", nodes[i])
                || getXmlValue(nodes[i], "text()"));
        }
    };
    
    this.$xmlUpdate = function(action, xmlNode, listenNode){
        //Added setting
        var nodes = this.XmlRoot.selectNodes(this.traverseRule || "node()[text()]");
        for (var i = 0; i < nodes.length; i++) {
            var name  = this.applyRuleSetOnNode("name", nodes[i]) || nodes[i].tagName;
            var value = this.applyRuleSetOnNode("value", nodes[i])
                || getXmlValue(nodes[i], "text()");
            if (this[name] != value) 
                this.setProperty(name, value);
        }
        
        //Deleted setting
        for (var prop in settings) {
            if (!this.getSettingsNode(this.XmlRoot, prop)) {
                this.setProperty(prop, null);
                delete this[prop];
                delete settings[prop];
            }
        }
    };
    
    this.reset = function(){
        if (!savePoint) return;

        this.load(jpf.xmldb.copyNode(savePoint));
    };
    
    //Properties
    this.getSettingsNode = function(xmlNode, prop, create){
        if (!xmlNode) 
            xmlNode = this.XmlRoot;
        
        var nameNode  = this.getNodeFromRule("name", this.XmlRoot);
        var valueNode = this.getNodeFromRule("value", this.XmlRoot);
        nameNode      = nameNode ? nameNode.getAttribute("select") : "@name";
        valueNode     = valueNode ? valueNode.getAttribute("select") || "text()" : "text()";
        var traverse  = this.traverseRule + "[" + nameNode + "='" + prop + "']/"
            + valueNode || prop + "/" + valueNode;
        
        return create
            ? jpf.xmldb.createNodeFromXpath(xmlNode, traverse)
            : jpf.getXmlValue(this.xmlNode, traverse);
    };
    
    this.handlePropSet = function(prop, value, force){
        if (!force && this.XmlRoot) 
            return jpf.xmldb.setNodeValue(this.getSettingsNode(
                this.XmlRoot, prop, true), true);
        
        this[prop]     = value;
        settings[prop] = value;
    };
    
    //Init
    this.loadJml = function(x){
        this.importSettings(x.getAttribute("get"), x.getAttribute("default"));
        this.exportInstruction = x.getAttribute("set");
        
        this.jml = x;
        jpf.JmlParser.parseChildren(this.jml, null, this);
        
        //Model handling in case no smartbinding is used
        var modelId = jpf.xmldb.getInheritedAttribute(x, "model");
        
        for (var i = 0; i < jpf.JmlParser.modelInit.length; i++) 
            if (jpf.JmlParser.modelInit[i][0] == this) 
                return;
        
        jpf.setModel(modelId, this);
    };
    
    //Destruction
    this.destroy = function(){
        if (this.exportInstruction) 
            this.exportSettings(this.exportInstruction);
    };
};

//#endif
