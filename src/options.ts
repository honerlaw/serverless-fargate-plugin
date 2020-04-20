export interface IVPCOptions {
    cidr: string;
    subnets: string[];
    //Optional ivars to dictate if will use existing VPC 
    //and subnets specified
    vpcId: string;
    securityGroupIds: string[];
    subnetIds: string[];
}

export interface IServiceProtocolOptions {
    protocol: "HTTP" | "HTTPS";
    certificateArns?: string[]; // needed for https
    authorizer?: {
        poolArn: string;
        clientId: string;
        poolDomain: string;
    }; //available on HTTPS only
}

enum AutoScalingMetricType {
    ALBRequestCountPerTarget,
    AppStreamAverageCapacityUtilization,
    ComprehendInferenceUtilization,
    DynamoDBReadCapacityUtilization,
    DynamoDBWriteCapacityUtilization,
    EC2SpotFleetRequestAverageCPUUtilization,
    EC2SpotFleetRequestAverageNetworkIn,
    EC2SpotFleetRequestAverageNetworkOut,
    ECSServiceAverageCPUUtilization,
    ECSServiceAverageMemoryUtilization,
    LambdaProvisionedConcurrencyUtilization,
    RDSReaderAverageCPUUtilization,
    RDSReaderAverageDatabaseConnections,
    SageMakerVariantInvocationsPerInstance
};

export interface IServiceAutoScalingOptions {
    min?: number; //default to 1
    max?: number; //default to 1
    metric: AutoScalingMetricType;
    cooldown?: number; //defaults to 30
    cooldownIn?: number; //defaults to cooldown but has priority over it
    cooldownOut?: number; //defaults to cooldown but has priority over it
    targetValue: number;
}

export interface IServiceOptions {
    name: string;
    cpu: number;
    memory: number;
    port?: number; // docker port (the port exposed on the docker image) - if not specified random port will be used - usefull for busy private subnets 
    entryPoint: string[]; //custom container entry point
    disableELB?: boolean; //useful for disabling ELB listeners on a cluster that has ELB and more tasks with ELB enabled
    environment: { [key: string]: string };
    protocols: IServiceProtocolOptions[];
    image?: string;
    imageRepository?: string;
    imageTag?: string;
    priority?: number; // priority for routing, defaults to 1
    path?: string | { path: string, method?: string }[]; // path the LB should send traffic to, defaults '*' (everything)
    desiredCount?: number; // defaults to 1
    autoScale?: IServiceAutoScalingOptions;
    taskRoleArn?: string;
    healthCheckUri?: string; // defaults to "/"
    healthCheckProtocol?: string; // defaults to "HTTP"
    healthCheckInterval?: number // in seconds, defaults to 6 seconds
}

export interface IClusterOptions {
    public: boolean;
    disableELB?: boolean;
    clusterName: string;
    executionRoleArn?: string; // role for services, generated if not specfied
    vpc: IVPCOptions;
    tags?: object;
    services: IServiceOptions[];
}
