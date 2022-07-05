import { Fn, Stack, StackProps } from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Cluster, ContainerImage, LogDriver, Secret } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService, ApplicationLoadBalancedServiceRecordType } from 'aws-cdk-lib/aws-ecs-patterns';
import { ApplicationProtocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class TegolaMapEcsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    

    // The code that defines your stack goes here
    

    const repository = Repository.fromRepositoryAttributes(this, "ercRespository", {
      repositoryArn: Fn.importValue("ecrArn-liang"),
      repositoryName: Fn.importValue("ecrName-liang")
    })

    
    
  }
}