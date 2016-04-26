var FS = require('fs');
var getSchema = require('./schemas.js');
var Converter = module.exports = {};
var DESCRIPTION = FS.readFileSync(__dirname + '/../data/description.md', 'utf8')
var URL = require('url');
var API_HOST = "fhirsandbox-prod.apigee.net";
var API_BASE = "/fhir/v1/";
var OAUTH_BASE = "/oauth/v2/";
var PROTOCOL = "https://";
var API_URL = PROTOCOL+API_HOST;

var INTERACTIONS = {
    instance: ['read', 'vread', 'update', 'delete', 'history'],
    type: ['create', 'search-type', 'history-type', 'history-instance'],
	requirement:['meta-instance-history','meta-instance','meta-type','post-search','meta-add-instance','meta-add-instance-history','compartment-instance']
}
INTERACTIONS.all = INTERACTIONS.instance.concat(INTERACTIONS.type).concat(INTERACTIONS.requirement);
var DEFAULT_INTERACTIONS = INTERACTIONS.all.map(function(i) {
    return {
        code: i
    }
})
var schemaRef;
var metaschemaRef;
Converter.convert = function(options, conf) {
    var all_individual_swagger = [];    
    if(options.API_HOST)
    	API_HOST = options.API_HOST;
    if(options.API_BASE)
    	API_BASE = options.API_BASE;
    if(options.OAUTH_BASE)
    	OAUTH_BASE = options.OAUTH_BASE;
    if(options.PROTOCOL)
    	PROTOCOL = options.PROTOCOL;
    
    API_URL = PROTOCOL+API_HOST;
    var resources = conf.rest[0].resource;
    
    resources.forEach(function(res) {
		var mod_res = [];
        mod_res.push(res);
        var read_write_scopes = mod_res.map(function(res) {
            var orig_res = res.type;
            res = res.type.substring(0, 1).toUpperCase() + res.type.substring(1).toLowerCase();
            var temp_scope = [];
            temp_scope.push("patient/" + res + ".read");
            temp_scope.push("patient/" + res + ".write");
            temp_scope.push(res);
            temp_scope.push(orig_res);
            return temp_scope;
        })
		var getDefaultOp = function(res,type) {
			var response = {"default" :{ "description": "unexpected error"} };
			var scope_type;
			
			switch(type) {
				case 'vread':
				case 'read':
					scope_type = read_write_scopes[0][0];
					response["200"]={
						"description": read_write_scopes[0][3]+ " Instance",
						"schema" : {
								$ref: schemaRef
							}
						};
					break;
				case 'update':
					scope_type = read_write_scopes[0][1];
					response["200"]= {"description": read_write_scopes[0][3]+" Updated."};
					response["201"]= {"description": read_write_scopes[0][3]+" Created."};
					response["400"]= {"description": read_write_scopes[0][3]+" could not be parsed or failed basic FHIR validation rules (or multiple matches were found)."};
					response["403"]= {"description": "Not Authorized."};
					response["412"]= {"description": "The given criteria is not selective enough."};
					break;
				case 'delete':
					scope_type = read_write_scopes[0][1];
					response["200"]= {"description": "No Content."};
					response["204"]= {"description": "No Content."};
					response["404"]= {"description": read_write_scopes[0][3]+" not found."};
					response["405"]= {"description": "Method not allowed."};
					response["409"]= {"description": "Conflict Error."};
					response["412"]= {"description": "The given criteria is not selective enough."};
					break;
				case 'meta-add-instance':
				case 'meta-add-instance-history':
				case 'create':
					scope_type = read_write_scopes[0][1];
					response["201"]= {"description": "Successful creation"};
					response["400"]= {"description": read_write_scopes[0][3]+" could not be parsed or failed basic FHIR validation rules"};
					response["404"]= {"description": read_write_scopes[0][3]+" not found."};
					response["422"]= {"description": "The "+read_write_scopes[0][3]+" resource violated applicable FHIR profiles or server business rules."};
					break;
				case 'history-type':
				case 'history-instance':
				case 'search-type':
				case 'post-search':
					scope_type = read_write_scopes[0][0];
					response["200"]={
						"description": read_write_scopes[0][3]+ " bundle" ,
						schema : {
							type : 'array' ,
							items: {
								$ref:schemaRef
							}
						}
					}
					break;
				case 'meta-instance-history':
					scope_type = read_write_scopes[0][0];
					response["200"]= {"description": "List of all tags, profiles and security labels affixed to the nominated version of the resource."};
					break;
				case 'meta-instance':
					scope_type = read_write_scopes[0][0];
					response["200"]= {"description": "List of all tags, profiles and security labels affixed to the nominated resource."};
					break;
				case 'meta-type':
					scope_type = read_write_scopes[0][0];
					response["200"]= {"description": "List of all tags, profiles and security labels used for "+read_write_scopes[0][3]};
					break;
				case 'compartment-instance':
					scope_type = read_write_scopes[0][0];
					response["200"]= {"description": "The set of resources associated with a particular "+read_write_scopes[0][3]};
					break;
			}			
			
			return {
				parameters: [],
				security: [
					{
						outhB2C: [
							scope_type
						]
					}
				],
				produces: [
					"application/json+fhir;charset=UTF-8",
					"application/xml+fhir;charset=UTF-8"
				],
				responses: response
			}
		}

        var scopes_for_securityDef = '{"' + read_write_scopes[0][0] + '" : "Read permissions for ' + read_write_scopes[0][2] + ' demographics.", "' + read_write_scopes[0][1] + '" : "Write permissions for ' + read_write_scopes[0][2] + ' demographics."}';
			
		var swagger = {
			swagger: '2.0',
			definitions: {},
			paths: {},
			info: {
				description: DESCRIPTION,
				version: '1.0.0',
				title: "FHIR " + read_write_scopes[0][2] + " resource API documentation"
			},
			host: API_HOST,
			schemes: ["https"],
			basePath: API_BASE + read_write_scopes[0][3],
			produces: [
				"application/json+fhir;charset=UTF-8",
				"application/xml+fhir;charset=UTF-8"
			],
			securityDefinitions: {
				"outhB2C": {
					"type": "oauth2",
					"description": "Security scheme for B2C flow using authorization code flow.",
					"scopes": JSON.parse(scopes_for_securityDef),
					"flow": "Authorization_code",
					"authorizationUrl": API_URL + OAUTH_BASE +"authorize?scope=" + read_write_scopes[0][0] + "&state=uyrjiqa23nv8650ndj",
					"tokenUrl": API_URL + OAUTH_BASE +"accesstoken"
				}
			},
			security: [{
				"outhB2C": [read_write_scopes[0][0] , read_write_scopes[0][1]]
			}]
		};
        if (!res.searchParam) return;
        var schema = swagger.definitions[res.type] = getSchema(res);
        schemaRef = '#/definitions/' + res.type;		
		var schema_2 = swagger.definitions['metaBody'] = {type : "string"};		
		metaschemaRef = '#/definitions/metaBody';
        /*
		 * //previous res.interaction = res.interaction || DEFAULT_INTERACTIONS;
		 */
		res.interaction = DEFAULT_INTERACTIONS;
        var interactions = res.interaction.map(s => s.code);
		var typeOps = swagger.paths[''] = {
			parameters:[]
		};		
		if (interactions.indexOf('create') !== -1) {
            typeOps.post = getDefaultOp(res,'create');
			base_params_add(typeOps.post.parameters,base_header_params,null,null,null,null);
			typeOps.post.operationId = "Create "+res.type;
			typeOps.post.description = "Create a new "+res.type+" with a server assigned id.<p><a href = 'https://www.hl7.org/fhir/"+(res.type).toLowerCase()+".html'>FHIR documentation for "+res.type+".</a></p>";if(res.conditionalCreate){
				base_write_params(typeOps.post.parameters,'cond_post',null);
			}else{
				base_write_params(typeOps.post.parameters,'post',null);
			}	         
        }
		if (interactions.indexOf('update') !== -1 && res.conditionalUpdate) {
            typeOps.put = getDefaultOp(res,'update');			
			typeOps.put.operationId = res.type+" Conditional Update";
			typeOps.put.description = "The conditional update interaction is used to update an existing "+res.type+" based on some identification criteria, rather than by logical id.<p><a href = 'https://www.hl7.org/fhir/"+(res.type).toLowerCase()+".html'>FHIR documentation for "+res.type+".</a></p>";
			base_params_add(typeOps.put.parameters,base_header_params,null,null,null,null);
			base_write_params(typeOps.put.parameters,'cond_put',res);
            
        }
		if (interactions.indexOf('delete') !== -1 && res.conditionalDelete) {
            typeOps.delete = getDefaultOp(res,'delete');
			base_write_params(typeOps.delete.parameters,'cond_delete',res);
			base_params_add(typeOps.delete.parameters,base_header_params,null,null,null,null);
			typeOps.delete.operationId = res.type+" Conditional Delete";
			typeOps.delete.description = "The conditional delete interaction allows a client to delete "+res.type+"/"+res.type+"s  based on some selection criteria, rather than by a specific logical id.<p><a href = 'https://www.hl7.org/fhir/"+(res.type).toLowerCase()+".html'>FHIR documentation for "+res.type+".</a></p>";
        }
		if (interactions.indexOf('search-type') !== -1) {
            typeOps.get = getDefaultOp(res,'search-type');
			base_params_add(typeOps.get.parameters,base_header_params,base_query_params,null,null,null);
			res_search_params(typeOps.get.parameters,res,'query');			
			typeOps.get.operationId = res.type + "s Search";
			typeOps.get.description = "Returns "+res.type+"s based on filter criteria OR Provides provision for pagination (stateid, page, page_size, _pretty & _bundletype are query parameters used for Paging).<p><a href = 'https://www.hl7.org/fhir/"+(res.type).toLowerCase()+".html'>FHIR documentation for "+res.type+".</a></p>";
			/*
			 * typeOps.get.responses['200'].schema = { type: 'array', items: {
			 * $ref: schemaRef } }
			 */
        }				
        var instOps = swagger.paths['/{id}'] = {
            parameters: []
        };
		if(interactions.indexOf('read') !== -1) {
            instOps.get = getDefaultOp(res,'read');
            /*
			 * instOps.get.responses['200'].schema = { $ref: schemaRef };
			 */
			base_params_add(instOps.get.parameters,base_header_params,base_query_params,null,base_id_params,null);
			instOps.get.operationId = "Read "+res.type;
			instOps.get.description = "Returns details of "+res.type+" having id given in path.<p><a href = 'https://www.hl7.org/fhir/"+(res.type).toLowerCase()+".html'>FHIR documentation for "+res.type+".</a></p>";
        }
		if(interactions.indexOf('update') !== -1) {
            instOps.put = getDefaultOp(res,'update');
			base_params_add(instOps.put.parameters,base_header_params,null,null,base_id_params,null);
			instOps.put.operationId = "Update "+res.type;
			instOps.put.description = "Update an existing "+res.type+" by its id (or create it if it is new).<p><a href = 'https://www.hl7.org/fhir/"+(res.type).toLowerCase()+".html'>FHIR documentation for "+res.type+".</a></p>";
			base_write_params(instOps.put.parameters,'put',null);
        }
        if(interactions.indexOf('delete') !== -1) {
            instOps.delete = getDefaultOp(res,'delete');
			base_params_add(instOps.delete.parameters,base_header_params,null,null,base_id_params,null);
			instOps.delete.operationId = "Delete "+res.type;
			instOps.delete.description = "The delete interaction removes an existing "+res.type+".<p><a href = 'https://www.hl7.org/fhir/"+(res.type).toLowerCase()+".html'>FHIR documentation for "+res.type+".</a></p>";
			base_write_params(instOps.delete.parameters,'delete',null);
        }
        if(interactions.indexOf('history-instance') !== -1) {
            var histOp = swagger.paths['/{id}/_history'] = {
                get: getDefaultOp(res,'history-instance')
            }
			// histOp = histOp.get;
			base_params_add(histOp.get.parameters,base_header_params,base_query_params,base_history_params,base_id_params,null);
			histOp.get.operationId = res.type + " History";
			histOp.get.description = "It retrieves the history of a particular "+res.type+" identified by the given id in path.<p><a href = 'https://www.hl7.org/fhir/"+(res.type).toLowerCase()+".html'>FHIR documentation for "+res.type+".</a></p>";     
        }
        if(interactions.indexOf('history-type') !== -1) {
            var histOp = swagger.paths['/_history'] = {
                get: getDefaultOp(res,'history-type')
            }
            // histOp = histOp.get;
			base_params_add(histOp.get.parameters,base_header_params,base_query_params,base_history_params,null,null);
			histOp.get.operationId = res.type + "s History";
			histOp.get.description = "It retrieves the history of all resources of "+res.type+".<p><a href = 'https://www.hl7.org/fhir/"+(res.type).toLowerCase()+".html'>FHIR documentation for "+res.type+".</a></p>";
        }
        if(interactions.indexOf('vread') !== -1) {
            var versionOp = swagger.paths['/{id}/_history/{vid}'] = {
                get: getDefaultOp(res,'vread')
            };
            // versionOp = versionOp.get;
            versionOp.get.parameters = [{
                name: 'vid',
                in: 'path',
                type: 'string'
            }];
			base_params_add(versionOp.get.parameters,base_header_params,base_query_params,base_history_params,base_id_params,null);
			versionOp.get.operationId = res.type + " Version Read";
			versionOp.get.description = "This interaction preforms a version specific read of "+res.type+" resource.<p><a href = 'https://www.hl7.org/fhir/"+(res.type).toLowerCase()+".html'>FHIR documentation for "+res.type+".</a></p>";			
            /*
			 * versionOp.get.responses['200'].schema = { $ref: schemaRef };
			 */
        }
		if(interactions.indexOf('meta-type') !== -1){
			var metaOp = swagger.paths['/$meta'] = {
                get: getDefaultOp(res,'meta-type')
            };
			metaOp.get.operationId = res.type + "s Metadata";
			metaOp.get.description = "Retrieves a summary of the profiles, tags, and security labels for "+res.type+"s.<p><a href = 'https://www.hl7.org/fhir/"+(res.type).toLowerCase()+".html'>FHIR documentation for "+res.type+".</a></p>";
			base_params_add(metaOp.get.parameters,base_header_params,base_query_params,null,null,null);
		}
		if(interactions.indexOf('meta-instance') !== -1){
			var metaOp = swagger.paths['/{id}/$meta'] = {
                get: getDefaultOp(res,'meta-instance')
            };
			metaOp.get.operationId = res.type + " Metadata";
			metaOp.get.description = "Retrieves a summary of the profiles, tags, and security labels for given "+res.type+" resource.<p><a href = 'https://www.hl7.org/fhir/"+(res.type).toLowerCase()+".html'>FHIR documentation for "+res.type+".</a></p>";
			base_params_add(metaOp.get.parameters,base_header_params,base_query_params,null,base_id_params,null);
		}
		if(interactions.indexOf('meta-instance-history') !== -1){
			var metaOp = swagger.paths['/{id}/_history/{vid}/$meta'] = {
                get: getDefaultOp(res,'meta-instance-history')
            };
			metaOp.get.parameters = [{
                name: 'vid',
                in: 'path',
                type: 'string'
            }];
			metaOp.get.operationId = res.type + " Version based Metadata";
			metaOp.get.description = "Retrieves a summary of the profiles, tags, and security labels for given version of the "+res.type+".<p><a href = 'https://www.hl7.org/fhir/"+(res.type).toLowerCase()+".html'>FHIR documentation for "+res.type+".</a></p>";
			base_params_add(metaOp.get.parameters,base_header_params,base_query_params,null,base_id_params,null);
		}
		if(interactions.indexOf('compartment-instance') !== -1){
			var compOp = swagger.paths['/{id}/{type}'] = {
                get: getDefaultOp(res,'compartment-instance')
            };
			compOp.get.parameters = [{
                name: 'type',
                in: 'path',
                type: 'string'
            }];
			compOp.get.operationId = " Compartment Search";
			compOp.get.description = "Search the specified resource type in "+res.type+" compartment.<p><a href = 'https://www.hl7.org/fhir/"+(res.type).toLowerCase()+".html'>FHIR documentation for "+res.type+".</a></p>";
			base_params_add(compOp.get.parameters,base_header_params,base_query_params,null,base_id_params,null);
		}
		if(interactions.indexOf('post-search') !== -1){
			var searchOp = swagger.paths['/_search'] = {
                post: getDefaultOp(res,'post-search')
            };
			res_search_params(searchOp.post.parameters,res,'query');
			res_search_params(searchOp.post.parameters,res,'formData');
			searchOp.post.operationId = res.type + "s Search using POST";
			searchOp.post.description = "This interaction searches a set of "+res.type+"s based on some filter criteria. Search interactions take a series of parameters of name'='value pairs encoded as an application/x-www-form-urlencoded submission for a POST.<p><a href = 'https://www.hl7.org/fhir/"+(res.type).toLowerCase()+".html'>FHIR documentation for "+res.type+".</a></p>";
			base_params_add(searchOp.post.parameters,base_header_params,null,null,null,null);
			
		}
		if(interactions.indexOf('meta-add-instance') !== -1){
			var metaaddOp = swagger.paths['/{id}/$meta-add'] = {
                post: getDefaultOp(res,'meta-add-instance')
            };
			metaaddOp.post.operationId = "Add " + res.type + " metadata";
			metaaddOp.post.description = "Add a metadata info "+res.type+" with specified id.<p><a href = 'https://www.hl7.org/fhir/"+(res.type).toLowerCase()+".html'>FHIR documentation for "+res.type+".</a></p>";
			base_write_params(metaaddOp.post.parameters,'meta-add',null);
			base_params_add(metaaddOp.post.parameters,base_header_params,null,null,base_id_params,null);
		}
		if(interactions.indexOf('meta-add-instance-history') !== -1){
			var metaaddOp = swagger.paths['/{id}/_history/{vid}/$meta-add'] = {
                post: getDefaultOp(res,'meta-add-instance-history')
            };
			metaaddOp.post.operationId = "Add " + res.type + " Version based Metadata";
			metaaddOp.post.description = "Add metadata info to specified "+res.type+" resource.<p><a href = 'https://www.hl7.org/fhir/"+(res.type).toLowerCase()+".html'>FHIR documentation for "+res.type+".</a></p>";
			metaaddOp.post.parameters = [{
                name: 'vid',
                in: 'path',
                type: 'string'
            }];
			base_write_params(metaaddOp.post.parameters,'meta-add',null);
			base_params_add(metaaddOp.post.parameters,base_header_params,null,null,base_id_params,null);
		}		
        all_individual_swagger.push(swagger);
    });
    return all_individual_swagger;
}
var convertType = function(type) {
    if (type === 'token') return 'string';
    if (type === 'date') return 'string';
    if (type === 'quantity' || type === 'number') return 'integer';
    return type;
}
var getFormat = function(type) {
    if (type === 'date') return 'date';
}
var base_params_add = function(source,header,query,history,id,body) {
	if(source){
		if(header){
			header.forEach(function(res) {
				source.push(res);
			})
		}
		if(query){
			query.forEach(function(res) {
				source.push(res);
			})
		}
		if(history){
			history.forEach(function(res) {
				source.push(res);
			})
		}
		if(id){
			id.forEach(function(res) {
				source.push(res);
			})
		}
		if(body){
			console.log(JSON.stringify(schemaRef));
			body.forEach(function(res) {
				source.push(res);
			})
		}
	}	
}
var base_history_params = [
	{
		"name": "_count",
		"in": "query",
		"description": "Number of records needed in response.",
		"type": "integer"
	},
	{
		"name": "_since",
		"in": "query",
		"description": "Specify an instant to only include resource versions that were created at or after the given instant in time. An instant in time is known at least to the second and always includes a time zone.",
		"type": "string",
		"pattern": "([1-9][0-9]{3}|0[0-9]{3})(-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01])(T(([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]+)?|(24:00:00(\\.0+)?))(Z|(\\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?)?)?)?"
	}
];
var base_id_params = [
	{
		"name": "id",
		"description": "The logical resource id associated with the Resource.",
		"type": "string",
		"pattern": "[a-z0-9\\-\\.]{1,64}",
		"required": true,
		"in": "path"
	}
];
var base_header_params = [
	{
		"name": "Authorization",
		"in": "header",
		"required": false,
		"default": "Bearer [access_token]",
		"description": "Specify access token for API in the given format: Bearer [access_token].",
		"type": "string"
	},
	{
		"name": "Accept",
		"description": "The Accept request-header field can be used to specify certain media types which are acceptable for the response.",
		"in": "header",
		"required": false,
		"default": "application/json+fhir;charset=UTF-8",
		"type": "string"
	}			
];		
var base_query_params = [
	{
		"name": "_format",
		"in": "query",
		"description": "Format of data to be returned.",
		"type": "string",
		"x-consoleDefault" : "application/json"
	}
];
var base_body_params = [{
		"name": "Resource data",
		"in": "body",
		"description": "The request body should be a valid meta payload.",
		"required": true,
		"schema": {
			"$ref": schemaRef
		}
	}
];
var res_search_params = function (source,param_list,in_type){
	if(source && param_list.searchParam){
		param_list.searchParam.map(function(param) {
			var swagParam = {
				name: param.name,
				type: convertType(param.type),
				in: in_type,
				description: param.documentation || ''
			}
			var format = getFormat(param.type);
			
			if (format) {
				swagParam.format = format;				
				var temp = [];
				
				temp.push(JSON.parse(JSON.stringify(swagParam)));
				temp[0].description = temp[0].description.concat(". The date parameter format is yyyy-mm-ddThh:nn:ss(TZ). The prefixes >, >=, <= and < may be used on the parameter value.");
				
				temp.push(JSON.parse(JSON.stringify(swagParam)));
				temp[1].description = temp[1].description.concat(". The date parameter format is yyyy-mm-ddThh:nn:ss(TZ). Two dates can be used to specify an interval. The prefixes >, >=, <= and < may be used on the parameter value.");
				
				source.push(temp[0]);
				source.push(temp[1]);
			}else{
				source.push(swagParam);
			}
			
		});
	}
};
var base_write_params = function (source,type,res){
	var content_type = {
		"name": "Content-Type",
		"in": "header",
		"required": true,
		"description": "Specifies the format of data in body",
		"type": "string"
	};
	var res_add_param = {
		"name": "Resource data",
		"in": "body",
		"description": "The request body should be a valid meta payload.",
		"required": true,
		"schema": {
			"$ref": schemaRef
		}
	};
	var meta_add_param = {
		"name": "Resource data",
		"in": "body",
		"description": "The request body should be a valid meta payload.",
		"required": true,
		"schema": {
			"$ref": metaschemaRef
		}
	};
	
	if(source && type){
		if(type == 'cond_post'){
			source.push(res_add_param);
			source.push(content_type);
			
			source.push({   "name": "If-None-Exist",
							"in": "header",
							"required": false,
							"description": "Specify the search query for conditional create.",
							"type": "string"
						});
			// base_params_add(source,null,null,null,null,base_body_params);
		}
		if(type == 'cond_put'){
			source.push(res_add_param);
			source.push(content_type);
			res_search_params(source,res,'query');			
			// base_params_add(source,null,null,null,null,base_body_params);
		}
		if(type == 'cond_delete'){
			res_search_params(source,res,'query');
		}
		if(type == 'post'){
			source.push(res_add_param);
			source.push(content_type);
			// base_params_add(source,null,null,null,null,base_body_params);
		}
		if(type == 'put'){
			source.push(res_add_param);
			source.push(content_type);
			// base_params_add(source,null,null,null,null,base_body_params);
		}
		if(type == 'delete'){
			// source.push();
		}
		if(type == 'meta-add'){
			source.push(content_type);
			source.push(meta_add_param);
		}
	}
};