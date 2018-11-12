/**
 *
 * So we can technically creeate a two step process here
 * Step 1, create a VPC, Load Balancer, and ECS Cluster (this is per environment, e.g. prod / qa / dev / stage /  etc)
 * Step 2, create the service (TaskDefinition, Service, TargetGroup, ListenerRule)
 */
import {Cluster} from "./cluster";
import {VPC} from "./vpc";
import {IPluginOptions} from "./definitions";

class ServerlessFargatePlugin {

    private readonly serverless: any;
    private readonly hooks: {[key: string]: Function};
    private readonly provider: string;

    constructor(serverless: any, options: any) {
        this.serverless = serverless;
        this.provider = 'aws';

        this.hooks = {
            'deploy:compileFunctions': this.compile.bind(this)
        }
    }

    private compile(): void {

        const options: IPluginOptions = this.serverless.service.custom.fargate;

        // we could want more than one cluster in the future potentially per vpc
        const vpc: VPC = new VPC(options.vpc);
        const cluster: Cluster = new Cluster(options, vpc);

        // merge all our stuff into resources
        Object.assign(
            this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
            vpc.generate(),
            cluster.generate()
        );
    }

}

export = ServerlessFargatePlugin;
