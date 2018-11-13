import {IVPCOptions} from "../options";
import {NamePostFix, Resource} from "../resource";

export class VPC extends Resource<IVPCOptions> {

    private readonly subnetNames: string[];

    public constructor(options: IVPCOptions) {
        super(options);
        this.subnetNames = this.options.subnets
            .map((subnet: string, index: number): string => `${this.getName(NamePostFix.SUBNET_NAME)}${index}`);
    }

    public getSubnetNames(): string[] {
        return this.subnetNames;
    }

    public generate(): any {
        const vpc: string = this.options.cidr;
        const subnets: string[] = this.options.subnets;

        return Object.assign({
            [this.getName(NamePostFix.VPC)]: {
                "Type": "AWS::EC2::VPC",
                "Properties": {
                    "EnableDnsSupport": true,
                    "EnableDnsHostnames": true,
                    "CidrBlock": vpc
                }
            },
            [this.getName(NamePostFix.INTERNET_GATEWAY)]: {
                "Type": "AWS::EC2::InternetGateway"
            },
            [this.getName(NamePostFix.GATEWAY_ATTACHMENT)]: {
                "Type": "AWS::EC2::VPCGatewayAttachment",
                "Properties": {
                    "VpcId": {
                        "Ref": this.getName(NamePostFix.VPC)
                    },
                    "InternetGatewayId": {
                        "Ref": this.getName(NamePostFix.INTERNET_GATEWAY)
                    }
                }
            },
            [this.getName(NamePostFix.ROUTE_TABLE)]: {
                "Type": "AWS::EC2::RouteTable",
                "Properties": {
                    "VpcId": {
                        "Ref": this.getName(NamePostFix.VPC)
                    }
                }
            },
            [this.getName(NamePostFix.ROUTE)]: {
                "Type": "AWS::EC2::Route",
                "DependsOn": this.getName(NamePostFix.GATEWAY_ATTACHMENT),
                "Properties": {
                    "RouteTableId": {
                        "Ref": this.getName(NamePostFix.ROUTE_TABLE)
                    },
                    "DestinationCidrBlock": "0.0.0.0/0",
                    "GatewayId": {
                        "Ref": this.getName(NamePostFix.INTERNET_GATEWAY)
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
                        "Ref": this.getName(NamePostFix.VPC)
                    },
                    "CidrBlock": subnet,
                    "MapPublicIpOnLaunch": true
                }
            };
            def[`${this.getName(NamePostFix.ROUTE_TABLE_ASSOCIATION)}${index}`] = {
                "Type": "AWS::EC2::SubnetRouteTableAssociation",
                    "Properties": {
                    "SubnetId": {
                        "Ref": subnetName
                    },
                    "RouteTableId": {
                        "Ref": this.getName(NamePostFix.ROUTE_TABLE)
                    }
                }
            };
            return def;
        });
    }

}