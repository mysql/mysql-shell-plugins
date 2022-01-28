//
//  Register a new item on a component. This allows further usage
//  of the item within the component
//  params:
//      component:  the component object where the item is to be added
//      name: the name of the item (script) to add to the component
//
var lib = ws.tokens.lib

var component = lib.init_lib_item.params.component
var operation = lib.init_lib_item.params.name
var operation_external = component.name + "/_" + operation

component[operation] = Object({
    "name": operation_external,
    "file": operation_external + ".js",
    "params": {},
    "result": {}
})
