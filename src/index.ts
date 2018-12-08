import {Cluster} from "./resources/cluster";
import {VPC} from "./resources/vpc";
import {IPluginOptions} from "./options";

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
        const options: IPluginOptions = service.custom.fargate;
        const stage: string = service.provider ? service.provider.stage : service.stage;

        // we could want more than one cluster in the future potentially per vpc
        const vpc: VPC = new VPC(stage, options.vpc);
        const cluster: Cluster = new Cluster(stage, options, vpc);

        // merge all our stuff into resources
        Object.assign(
            this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
            vpc.generate(),
            cluster.generate()
        );
    }

}

export = ServerlessFargatePlugin;
