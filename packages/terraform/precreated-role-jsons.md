# Pre-Created ECS Role JSONs

Use these files when the AWS account owner is creating the ECS roles manually in
the IAM console.

Current expected role names:

- `ember-migration-ecs-execution-role`
- `ember-migration-ecs-task-role`

For each role:

1. create the role with the trust policy JSON
2. attach the matching inline policy JSON

## ECS execution role

Role name:

- `ember-migration-ecs-execution-role`

Files:

- Trust policy: ecs-execution-role-trust-policy.json
- Inline policy: ecs-execution-role-inline-policy.json

## ECS task role

Role name:

- `ember-migration-ecs-task-role`

Files:

- Trust policy: ecs-task-role-trust-policy.json
- Inline policy: ecs-task-role-inline-policy.json
