export interface IVPCOptions {
    cidr: string;
    subnets: string[];
}

export interface IServiceProtocolOptions {
    protocol: "HTTP" | "HTTPS";
    certificateArns?: string[]; // needed for https
}

export interface IServiceOptions {
    name: string;
    cpu: number;
    memory: number;
    port: number;
    entryPoint: string[];
    protocols: IServiceProtocolOptions[];
    imageRepository: string;
    imageTag?: string;
    priority?: number; // priority for routing, defaults to 1
    path?: string; // path the LB should send traffic to, defaults '*' (everything)
    desiredCount?: number; // defaults to 1
    taskRoleArn?: string;
    healthCheckUri?: string; // defaults to "/"
    healthCheckProtocol?: string; // defaults to "HTTP"
}

export interface IPluginOptions {
    executionRoleArn?: string; // role for services, generated if not specfied
    vpc: IVPCOptions;
    services: IServiceOptions[];
}


export interface IAllOptions {
    executionRoleArn?: string; // execution role for services, generated if not specified
    vpc: {
        cidr: string;
        subnets: string[]; // subnet cidrs
    };
    services: Array<{
        name: string; // name of the service
        cpu: number;
        memory: number;
        port: number; // docker port (the port exposed on the docker image)
        entryPoint: string[]; // same as docker's entry point
        protocols: Array<{
            protocol: "HTTP" | "HTTPS";
            certificateArns?: string[]; // needed for https
        }>;
        imageRepository: string;
        imageTag?: string; //
        priority?: number; // priority for routing, defaults to 1
        path?: string; // path the Load Balancer should send traffic to, defaults to '*'
        desiredCount?: number; // defaults to 1
        taskRoleArn?: string;
        healthCheckUri?: string; // defaults to "/"
        healthCheckProtocol?: string; // defaults to "HTTP"
    }>
}