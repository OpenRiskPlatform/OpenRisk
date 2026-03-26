import { PluginInputs } from '../../../src/bindings/Plugin'; 

export default async function (inputs: PluginInputs) {
    console.log("Example pugin with inputs " + JSON.stringify(inputs, null, 2));
}