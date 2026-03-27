locals {
  resource_prefix   = replace(lower(var.name_prefix), "_", "-")
  alb_name          = substr("${local.resource_prefix}-alb", 0, 32)
  target_group_name = substr("${local.resource_prefix}-tg", 0, 32)
}

resource "aws_lb" "this" {
  name                       = local.alb_name
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [var.alb_security_group_id]
  subnets                    = var.public_subnet_ids
  enable_deletion_protection = false

  tags = merge(var.tags, {
    Name = local.alb_name
  })
}

resource "aws_lb_target_group" "this" {
  name        = local.target_group_name
  port        = 80
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    enabled             = true
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200-399"
    healthy_threshold   = 2
    unhealthy_threshold = 2
    interval            = 30
    timeout             = 5
  }

  tags = merge(var.tags, {
    Name = local.target_group_name
  })
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
}
