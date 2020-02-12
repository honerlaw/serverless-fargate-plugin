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
        
        //No cluster section specified, don't process
        if (!options || !options.length) return;

        //For each cluster
        for (let clusterOption of options) {
            const index = options.indexOf(clusterOption);
            //multiple self-created VPCs will be a problem here, TODO: solve this with cluster prefix on resouces
            const vpc: VPC = new VPC(stage, clusterOption.vpc);
            const cluster: Cluster = new Cluster(stage, clusterOption, vpc);

            // merge all our stuff into resources
            Object.assign(
                this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
                vpc.generate(),
                cluster.generate()
            );
        }
    }

}

export = ServerlessFargatePlugin;
