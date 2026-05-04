/**
 * HubbleWave Customer Instance Module - ALB Ingress Controller
 *
 * Provisions the AWS Load Balancer Controller for each customer cluster
 * to manage ALB ingress resources.
 */

# -----------------------------------------------------------------------------
# AWS Load Balancer Controller IRSA Role
# -----------------------------------------------------------------------------

module "aws_load_balancer_controller_irsa_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name                              = "hw-${local.instance_name}-alb-controller"
  attach_load_balancer_controller_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-load-balancer-controller"]
    }
  }

  tags = local.aws_tags
}

# -----------------------------------------------------------------------------
# AWS Load Balancer Controller Helm Release
# -----------------------------------------------------------------------------

resource "helm_release" "aws_load_balancer_controller" {
  provider   = helm.instance
  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  namespace  = "kube-system"
  version    = "1.7.1"

  set = [
    {
      name  = "clusterName"
      value = module.eks.cluster_name
    },
    {
      name  = "region"
      value = var.aws_region
    },
    {
      name  = "vpcId"
      value = module.vpc.vpc_id
    },
    {
      name  = "serviceAccount.create"
      value = "true"
    },
    {
      name  = "serviceAccount.name"
      value = "aws-load-balancer-controller"
    },
    {
      name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
      value = module.aws_load_balancer_controller_irsa_role.iam_role_arn
    },
    {
      name  = "resources.requests.cpu"
      value = "50m"
    },
    {
      name  = "resources.requests.memory"
      value = "128Mi"
    },
    {
      name  = "resources.limits.cpu"
      value = "200m"
    },
    {
      name  = "resources.limits.memory"
      value = "256Mi"
    }
  ]

  depends_on = [module.eks]
}

# -----------------------------------------------------------------------------
# ACM Certificate for Instance Domain
# -----------------------------------------------------------------------------

resource "aws_acm_certificate" "instance" {
  domain_name       = local.instance_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.aws_tags, {
    Name = "hw-${local.instance_name}-cert"
  })
}

# Certificate validation via Cloudflare DNS
resource "cloudflare_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.instance.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = var.cloudflare_zone_id
  name    = trimsuffix(each.value.name, ".${var.root_domain}.")
  type    = each.value.type
  content = trimsuffix(each.value.record, ".")
  ttl     = 60
  proxied = false
}

resource "aws_acm_certificate_validation" "instance" {
  certificate_arn         = aws_acm_certificate.instance.arn
  validation_record_fqdns = [for record in cloudflare_record.acm_validation : record.hostname]
}

# -----------------------------------------------------------------------------
# Instance Ingress (ALB)
# -----------------------------------------------------------------------------

resource "kubernetes_ingress_v1" "instance" {
  provider = kubernetes.instance

  metadata {
    name      = "instance-ingress"
    namespace = "default"

    annotations = {
      "kubernetes.io/ingress.class"                    = "alb"
      "alb.ingress.kubernetes.io/scheme"               = "internet-facing"
      "alb.ingress.kubernetes.io/target-type"          = "ip"
      "alb.ingress.kubernetes.io/certificate-arn"      = aws_acm_certificate.instance.arn
      "alb.ingress.kubernetes.io/listen-ports"         = jsonencode([{ "HTTPS" = 443 }])
      "alb.ingress.kubernetes.io/ssl-redirect"         = "443"
      "alb.ingress.kubernetes.io/healthcheck-path"     = "/api/health"
      "alb.ingress.kubernetes.io/healthcheck-interval" = "30"
      "alb.ingress.kubernetes.io/healthcheck-timeout"  = "5"
      "alb.ingress.kubernetes.io/healthy-threshold"    = "2"
      "alb.ingress.kubernetes.io/unhealthy-threshold"  = "3"
      "alb.ingress.kubernetes.io/tags"                 = "hubblewave.com/instance=${var.instance_id},hubblewave.com/customer=${var.customer_code}"
    }
  }

  spec {
    ingress_class_name = "alb"

    rule {
      host = local.instance_domain

      http {
        # AVA API path (GPU instances only)
        dynamic "path" {
          for_each = local.gpu_enabled_effective ? [1] : []
          content {
            path      = "/api/ava"
            path_type = "Prefix"
            backend {
              service {
                name = "ava-service"
                port {
                  number = 80
                }
              }
            }
          }
        }

        # Instance API
        path {
          path      = "/api"
          path_type = "Prefix"
          backend {
            service {
              name = "instance-api"
              port {
                number = 80
              }
            }
          }
        }

        # Web client (catch-all)
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "instance-web"
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }

  wait_for_load_balancer = true

  depends_on = [
    helm_release.aws_load_balancer_controller,
    aws_acm_certificate_validation.instance,
    kubernetes_service_v1.api,
    kubernetes_service_v1.web
  ]
}

# -----------------------------------------------------------------------------
# Cloudflare DNS Record pointing to ALB
# -----------------------------------------------------------------------------

resource "cloudflare_record" "instance" {
  zone_id = var.cloudflare_zone_id
  name    = "${var.customer_code}.${var.environment}"
  type    = "CNAME"
  content = kubernetes_ingress_v1.instance.status[0].load_balancer[0].ingress[0].hostname
  ttl     = 1
  proxied = false

  depends_on = [kubernetes_ingress_v1.instance]
}
