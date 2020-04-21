import {Cluster} from "./resources/cluster";
import {VPC} from "./resources/vpc";
import {IClusterOptions} from "./options";

class ServerlessFargatePlugin {

    private readonly serverless: any;
    private readonly hooks: {[key: string]: Function};
    private readonly provider: string;

    constructor(serverless: any, options: any) {
        this.serverless = serverless;
        this.hooks = {
            'deploy:compileFunctions': this.compile.bind(this)
        }
    }

    private compile(): void {
        const service: any = this.serverless.service;
        const options: IClusterOptions[] = service.custom.fargate;
        const stage: string = service.provider ? service.provider.stage : service.stage;
        const provider = this.serverless.getProvider('aws');
        const serviceName: string = provider.naming.getNormalizedFunctionName(service.service);
        
        //No cluster section specified, don't process
        if (!options || !options.length) {
            console.error('serverless-fargate-plugin: Cluster will not be deployed due missing options.');
        }

        //For each cluster
        for (let clusterOption of options) {
            if (clusterOption && clusterOption.vpc) { //sanity check for empty objects
                //multiple self-created VPCs will be a problem here, TODO: solve this with cluster prefix on resouces
                const vpc: VPC = new VPC(stage, clusterOption.vpc, clusterOption.tags);
                const cluster: Cluster = new Cluster(stage, clusterOption, vpc, serviceName, clusterOption.tags);

                // merge current cluster stuff into resources
                Object.assign(
                    this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
                    vpc.generate(),
                    cluster.generate()
                );

                // merge current cluster outputs into outputs
                Object.assign(
                    this.serverless.service.provider.compiledCloudFormationTemplate.Outputs,
                    vpc.getOutputs(),
                    cluster.getOutputs()
                );
            } else console.info('serverless-fargate-plugin: skipping cluster creation, missing informations (check required VPC).');
        }
    }

}

export = ServerlessFargatePlugin;
