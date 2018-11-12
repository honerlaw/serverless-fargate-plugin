import {IResourceGenerator, IVPCOptions} from "./definitions";

export class VPC implements IResourceGenerator {
    
    private static readonly SUBNET_NAME_PREFIX: string = 'PublicSubnet';

    private readonly options: IVPCOptions;

    public constructor(options: IVPCOptions) {
        this.options = options;
    }

    public getSubnetNames(): string[] {
        return this.options.subnets.map((subnet: string, index: number): string => `${VPC.SUBNET_NAME_PREFIX}${index}`);
    }

    public generate(): any {
        const vpc: string = this.options.cidr;
        const subnets: string[] = this.options.subnets;

        return Object.assign({
            "VPC": {
                "Type": "AWS::EC2::VPC",
                "Properties": {
                    "EnableDnsSupport": true,
                    "EnableDnsHostnames": true,
                    "CidrBlock": vpc
                }
            },
            "InternetGateway": {
                "Type": "AWS::EC2::InternetGateway"
            },
            "GatewayAttachement": {
                "Type": "AWS::EC2::VPCGatewayAttachment",
                "Properties": {
                    "VpcId": {
                        "Ref": "VPC"
                    },
                    "InternetGatewayId": {
                        "Ref": "InternetGateway"
                    }
                }
            },
            "PublicRouteTable": {
                "Type": "AWS::EC2::RouteTable",
                "Properties": {
                    "VpcId": {
                        "Ref": "VPC"
                    }
                }
            },
            "PublicRoute": {
                "Type": "AWS::EC2::Route",
                "DependsOn": "GatewayAttachement",
                "Properties": {
                    "RouteTableId": {
                        "Ref": "PublicRouteTable"
                    },
                    "DestinationCidrBlock": "0.0.0.0/0",
                    "GatewayId": {
                        "Ref": "InternetGateway"
                    }
                }
            },
        }, ...this.generateSubnets(subnets));
    }

    private generateSubnets(subnets: string[]): any[] {
        const subnetNames: string[] = this.getSubnetNames();

        return subnets.map((subnet: string, index: number): object => {
            const subnetName: string = subnetNames[index];
            const def: any = {};
            def[subnetName] = {
                "Type": "AWS::EC2::Subnet",
                "Properties": {
                    "AvailabilityZone": {
                        "Fn::Select": [
                            index,
                            {
                                "Fn::GetAZs": {
                                    "Ref": "AWS::Region"
                                }
                            }
                        ]
                    },
                    "VpcId": {
                        "Ref": "VPC"
                    },
                    "CidrBlock": subnet,
                    "MapPublicIpOnLaunch": true
                }
            };
            def[`PublicSubnet${index}RouteTableAssociation`] = {
                "Type": "AWS::EC2::SubnetRouteTableAssociation",
                    "Properties": {
                    "SubnetId": {
                        "Ref": subnetName
                    },
                    "RouteTableId": {
                        "Ref": "PublicRouteTable"
                    }
                }
            };
            return def;
        });
    }

}