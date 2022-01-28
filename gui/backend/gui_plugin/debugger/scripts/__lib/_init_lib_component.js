//
//  Register a new component into a parent component
//  params:
//      component: the parent component where this component is to be added
//      name: the name of the new sub-component
//
var lib = ws.tokens.lib

var parent = lib.init_lib_component.params.component
var componentName = lib.init_lib_component.params.name

parent[componentName] = Object({
    "name": parent.name + "/" + componentName
})
// parent[componentName]["name"] = parent.name + "/" + componentName
