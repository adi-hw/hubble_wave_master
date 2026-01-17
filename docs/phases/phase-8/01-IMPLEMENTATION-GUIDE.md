# Phase 8: Implementation Guide - Production & Mobile

**Version:** 1.0
**Last Updated:** 2025-12-30
**Status:** Production Implementation

## Overview

This guide provides detailed technical implementation instructions for deploying the HubbleWave platform to production, including infrastructure setup, monitoring, security hardening, and mobile app deployment.

## Table of Contents

1. [Production Architecture](#production-architecture)
2. [Kubernetes Deployment](#kubernetes-deployment)
3. [Monitoring & Alerting](#monitoring--alerting)
4. [Log Aggregation](#log-aggregation)
5. [Security Hardening](#security-hardening)
6. [Performance Tuning](#performance-tuning)
7. [CDN Configuration](#cdn-configuration)
8. [Database Optimization](#database-optimization)
9. [Disaster Recovery](#disaster-recovery)
10. [Mobile App Deployment](#mobile-app-deployment)

---

## Production Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Global CDN Layer                        │
│            (CloudFront / CloudFlare / Fastly)               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         WAF / DDoS                           │
│                    (CloudFlare / AWS WAF)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer                           │
│                    (ALB / NGINX / HAProxy)                   │
└─────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
┌───────────────────────┐           ┌───────────────────────┐
│   Kubernetes Cluster  │           │   Kubernetes Cluster  │
│      (Zone A)         │           │      (Zone B)         │
├───────────────────────┤           ├───────────────────────┤
│ - Web Pods (3+)       │           │ - Web Pods (3+)       │
│ - API Pods (5+)       │           │ - API Pods (5+)       │
│ - Worker Pods (2+)    │           │ - Worker Pods (2+)    │
│ - AVA Pods (2+)       │           │ - AVA Pods (2+)       │
└───────────────────────┘           └───────────────────────┘
            │                                   │
            └─────────────────┬─────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                               │
├──────────────────┬──────────────────┬───────────────────────┤
│   PostgreSQL     │   Redis Cache    │   S3 Storage         │
│   (Primary +     │   (Cluster)      │   (Media/Assets)     │
│   Read Replicas) │                  │                      │
└──────────────────┴──────────────────┴───────────────────────┘
```

### Infrastructure Components

#### Compute Layer
- **Kubernetes Cluster:** Multi-zone, auto-scaling
- **Node Pools:**
  - Web/API: 4-16 nodes (2 vCPU, 4GB RAM each)
  - Worker: 2-8 nodes (2 vCPU, 8GB RAM each)
  - AVA: 2-4 nodes (4 vCPU, 16GB RAM, GPU optional)

#### Data Layer
- **Primary Database:** PostgreSQL 15+ (16GB RAM, 4 vCPU)
- **Read Replicas:** 2+ replicas for read scaling
- **Cache:** Redis Cluster (3+ nodes)
- **Storage:** S3 or equivalent (unlimited, with versioning)

#### Network Layer
- **CDN:** Global edge network with 100+ POPs
- **WAF:** Layer 7 firewall with OWASP ruleset
- **Load Balancer:** Health-check enabled, SSL termination
- **VPC:** Private network with NAT gateway

---

## Kubernetes Deployment

### Cluster Setup

#### 1. Create Kubernetes Cluster

**AWS EKS Example:**
```bash
# Install eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# Create cluster configuration
cat > hubblewave-cluster.yaml <<EOF
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: hubblewave-prod
  region: us-east-1
  version: "1.28"

availabilityZones:
  - us-east-1a
  - us-east-1b
  - us-east-1c

managedNodeGroups:
  - name: web-api-nodes
    instanceType: t3.medium
    desiredCapacity: 6
    minSize: 4
    maxSize: 16
    volumeSize: 50
    labels:
      workload: web-api
    tags:
      Environment: production
      Project: HubbleWave

  - name: worker-nodes
    instanceType: t3.large
    desiredCapacity: 3
    minSize: 2
    maxSize: 8
    volumeSize: 100
    labels:
      workload: worker
    tags:
      Environment: production
      Project: HubbleWave

  - name: ava-nodes
    instanceType: t3.xlarge
    desiredCapacity: 2
    minSize: 2
    maxSize: 4
    volumeSize: 100
    labels:
      workload: ava
    tags:
      Environment: production
      Project: HubbleWave
EOF

# Create cluster
eksctl create cluster -f hubblewave-cluster.yaml
```

**Google GKE Example:**
```bash
# Create GKE cluster
gcloud container clusters create hubblewave-prod \
  --region us-central1 \
  --num-nodes 3 \
  --enable-autoscaling \
  --min-nodes 4 \
  --max-nodes 16 \
  --machine-type n1-standard-2 \
  --disk-size 50 \
  --enable-stackdriver-kubernetes \
  --enable-ip-alias \
  --network "projects/hubblewave/global/networks/prod-vpc" \
  --subnetwork "projects/hubblewave/regions/us-central1/subnetworks/prod-subnet" \
  --cluster-version "1.28" \
  --enable-autorepair \
  --enable-autoupgrade
```

#### 2. Configure kubectl

```bash
# AWS EKS
aws eks update-kubeconfig --name hubblewave-prod --region us-east-1

# Google GKE
gcloud container clusters get-credentials hubblewave-prod --region us-central1

# Verify connection
kubectl cluster-info
kubectl get nodes
```

### Application Deployment

#### 3. Create Namespace and ConfigMaps

```bash
# Create namespace
kubectl create namespace hubblewave-prod

# Create ConfigMap for environment variables
cat > config-prod.yaml <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: hubblewave-config
  namespace: hubblewave-prod
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  DB_HOST: "hubblewave-db.cluster-xxx.us-east-1.rds.amazonaws.com"
  DB_PORT: "5432"
  DB_NAME: "hubblewave"
  REDIS_HOST: "hubblewave-redis.xxx.cache.amazonaws.com"
  REDIS_PORT: "6379"
  S3_BUCKET: "hubblewave-prod-assets"
  CDN_URL: "https://cdn.hubblewave.com"
  API_BASE_URL: "https://api.hubblewave.com"
  WEB_BASE_URL: "https://app.hubblewave.com"
EOF

kubectl apply -f config-prod.yaml
```

#### 4. Create Secrets

```bash
# Create secrets for sensitive data
kubectl create secret generic hubblewave-secrets \
  --from-literal=DB_PASSWORD='your-db-password' \
  --from-literal=JWT_SECRET='your-jwt-secret' \
  --from-literal=STRIPE_SECRET_KEY='sk_live_xxx' \
  --from-literal=AWS_ACCESS_KEY_ID='xxx' \
  --from-literal=AWS_SECRET_ACCESS_KEY='xxx' \
  --from-literal=SENDGRID_API_KEY='SG.xxx' \
  --namespace=hubblewave-prod

# Verify secrets
kubectl get secrets -n hubblewave-prod
```

#### 5. Deploy Applications

**Web Application Deployment:**
```yaml
# web-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hubblewave-web
  namespace: hubblewave-prod
  labels:
    app: hubblewave-web
    tier: frontend
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: hubblewave-web
  template:
    metadata:
      labels:
        app: hubblewave-web
        tier: frontend
    spec:
      nodeSelector:
        workload: web-api
      containers:
      - name: web
        image: hubblewave/web:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 4200
          name: http
        envFrom:
        - configMapRef:
            name: hubblewave-config
        - secretRef:
            name: hubblewave-secrets
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 1000m
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 4200
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 4200
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
---
apiVersion: v1
kind: Service
metadata:
  name: hubblewave-web
  namespace: hubblewave-prod
  labels:
    app: hubblewave-web
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 4200
    protocol: TCP
    name: http
  selector:
    app: hubblewave-web
```

**API Deployment:**
```yaml
# api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hubblewave-api
  namespace: hubblewave-prod
  labels:
    app: hubblewave-api
    tier: backend
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2
      maxUnavailable: 1
  selector:
    matchLabels:
      app: hubblewave-api
  template:
    metadata:
      labels:
        app: hubblewave-api
        tier: backend
    spec:
      nodeSelector:
        workload: web-api
      containers:
      - name: api
        image: hubblewave/api:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
        envFrom:
        - configMapRef:
            name: hubblewave-config
        - secretRef:
            name: hubblewave-secrets
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 4Gi
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 60
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 3000
          initialDelaySeconds: 20
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
---
apiVersion: v1
kind: Service
metadata:
  name: hubblewave-api
  namespace: hubblewave-prod
  labels:
    app: hubblewave-api
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
    name: http
  selector:
    app: hubblewave-api
```

**Apply Deployments:**
```bash
kubectl apply -f web-deployment.yaml
kubectl apply -f api-deployment.yaml

# Verify deployments
kubectl get deployments -n hubblewave-prod
kubectl get pods -n hubblewave-prod
kubectl get services -n hubblewave-prod
```

#### 6. Configure Horizontal Pod Autoscaling

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: hubblewave-web-hpa
  namespace: hubblewave-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hubblewave-web
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: hubblewave-api-hpa
  namespace: hubblewave-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hubblewave-api
  minReplicas: 5
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

```bash
kubectl apply -f hpa.yaml
kubectl get hpa -n hubblewave-prod
```

#### 7. Configure Ingress

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: hubblewave-ingress
  namespace: hubblewave-prod
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
  - hosts:
    - app.hubblewave.com
    - api.hubblewave.com
    secretName: hubblewave-tls
  rules:
  - host: app.hubblewave.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: hubblewave-web
            port:
              number: 80
  - host: api.hubblewave.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: hubblewave-api
            port:
              number: 80
```

```bash
kubectl apply -f ingress.yaml
kubectl get ingress -n hubblewave-prod
```

---

## Monitoring & Alerting

### Prometheus Setup

#### 1. Install Prometheus Operator

```bash
# Add Prometheus Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus stack
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=100Gi \
  --set grafana.adminPassword=your-secure-password
```

#### 2. Configure ServiceMonitor

```yaml
# servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: hubblewave-api
  namespace: hubblewave-prod
  labels:
    app: hubblewave-api
spec:
  selector:
    matchLabels:
      app: hubblewave-api
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: hubblewave-web
  namespace: hubblewave-prod
  labels:
    app: hubblewave-web
spec:
  selector:
    matchLabels:
      app: hubblewave-web
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

```bash
kubectl apply -f servicemonitor.yaml
```

#### 3. Configure Alerting Rules

```yaml
# prometheus-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: hubblewave-alerts
  namespace: monitoring
  labels:
    prometheus: kube-prometheus
spec:
  groups:
  - name: hubblewave.rules
    interval: 30s
    rules:
    # High Error Rate
    - alert: HighErrorRate
      expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "High error rate detected"
        description: "Error rate is {{ $value }} for {{ $labels.service }}"

    # High Response Time
    - alert: HighResponseTime
      expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High response time detected"
        description: "95th percentile response time is {{ $value }}s"

    # Pod Down
    - alert: PodDown
      expr: kube_pod_status_phase{namespace="hubblewave-prod", phase!="Running"} == 1
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Pod is down"
        description: "Pod {{ $labels.pod }} in namespace {{ $labels.namespace }} is not running"

    # High CPU Usage
    - alert: HighCPUUsage
      expr: rate(container_cpu_usage_seconds_total{namespace="hubblewave-prod"}[5m]) > 0.8
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "High CPU usage detected"
        description: "CPU usage is {{ $value }} for {{ $labels.pod }}"

    # High Memory Usage
    - alert: HighMemoryUsage
      expr: container_memory_usage_bytes{namespace="hubblewave-prod"} / container_spec_memory_limit_bytes{namespace="hubblewave-prod"} > 0.9
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "High memory usage detected"
        description: "Memory usage is {{ $value }}% for {{ $labels.pod }}"

    # Database Connection Pool Exhaustion
    - alert: DatabaseConnectionPoolExhaustion
      expr: db_connection_pool_active / db_connection_pool_max > 0.9
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Database connection pool near exhaustion"
        description: "{{ $value }}% of database connections in use"

    # Redis Down
    - alert: RedisDown
      expr: redis_up == 0
      for: 2m
      labels:
        severity: critical
      annotations:
        summary: "Redis is down"
        description: "Redis instance {{ $labels.instance }} is not responding"
```

```bash
kubectl apply -f prometheus-rules.yaml
```

### Grafana Dashboards

#### 4. Access Grafana

```bash
# Port forward to access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Open browser to http://localhost:3000
# Login with admin / your-secure-password
```

#### 5. Import HubbleWave Dashboard

Create custom dashboard JSON (simplified example):

```json
{
  "dashboard": {
    "title": "HubbleWave Production Overview",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{namespace=\"hubblewave-prod\"}[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{namespace=\"hubblewave-prod\",status=~\"5..\"}[5m])"
          }
        ]
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{namespace=\"hubblewave-prod\"}[5m]))"
          }
        ]
      },
      {
        "title": "Pod Status",
        "targets": [
          {
            "expr": "kube_pod_status_phase{namespace=\"hubblewave-prod\"}"
          }
        ]
      }
    ]
  }
}
```

### AlertManager Configuration

#### 6. Configure AlertManager

```yaml
# alertmanager-config.yaml
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-prometheus-kube-prometheus-alertmanager
  namespace: monitoring
type: Opaque
stringData:
  alertmanager.yaml: |
    global:
      resolve_timeout: 5m
      slack_api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'

    route:
      group_by: ['alertname', 'cluster', 'service']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 12h
      receiver: 'default'
      routes:
      - match:
          severity: critical
        receiver: 'critical'
      - match:
          severity: warning
        receiver: 'warning'

    receivers:
    - name: 'default'
      slack_configs:
      - channel: '#hubblewave-alerts'
        title: 'HubbleWave Alert'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

    - name: 'critical'
      slack_configs:
      - channel: '#hubblewave-critical'
        title: 'CRITICAL: HubbleWave Alert'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
      pagerduty_configs:
      - service_key: 'your-pagerduty-key'

    - name: 'warning'
      slack_configs:
      - channel: '#hubblewave-warnings'
        title: 'Warning: HubbleWave Alert'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

```bash
kubectl apply -f alertmanager-config.yaml
```

---

## Log Aggregation

### ELK Stack Setup

#### 1. Install Elasticsearch

```bash
# Add Elastic Helm repository
helm repo add elastic https://helm.elastic.co
helm repo update

# Install Elasticsearch
helm install elasticsearch elastic/elasticsearch \
  --namespace logging \
  --create-namespace \
  --set replicas=3 \
  --set resources.requests.memory=4Gi \
  --set resources.limits.memory=4Gi \
  --set volumeClaimTemplate.resources.requests.storage=100Gi
```

#### 2. Install Kibana

```bash
# Install Kibana
helm install kibana elastic/kibana \
  --namespace logging \
  --set elasticsearchHosts=http://elasticsearch-master:9200
```

#### 3. Install Filebeat

```yaml
# filebeat-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: filebeat-config
  namespace: logging
data:
  filebeat.yml: |
    filebeat.inputs:
    - type: container
      paths:
        - /var/log/containers/*.log
      processors:
        - add_kubernetes_metadata:
            host: ${NODE_NAME}
            matchers:
            - logs_path:
                logs_path: "/var/log/containers/"

    output.elasticsearch:
      hosts: ['${ELASTICSEARCH_HOST:elasticsearch-master}:${ELASTICSEARCH_PORT:9200}']
      index: "hubblewave-logs-%{+yyyy.MM.dd}"

    setup.kibana:
      host: '${KIBANA_HOST:kibana-kibana}:${KIBANA_PORT:5601}'

    setup.ilm.enabled: true
    setup.ilm.rollover_alias: "hubblewave-logs"
    setup.ilm.pattern: "{now/d}-000001"
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: filebeat
  namespace: logging
spec:
  selector:
    matchLabels:
      app: filebeat
  template:
    metadata:
      labels:
        app: filebeat
    spec:
      serviceAccountName: filebeat
      containers:
      - name: filebeat
        image: docker.elastic.co/beats/filebeat:8.11.0
        args: ["-c", "/etc/filebeat.yml", "-e"]
        env:
        - name: ELASTICSEARCH_HOST
          value: elasticsearch-master
        - name: ELASTICSEARCH_PORT
          value: "9200"
        - name: KIBANA_HOST
          value: kibana-kibana
        - name: KIBANA_PORT
          value: "5601"
        - name: NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
        volumeMounts:
        - name: config
          mountPath: /etc/filebeat.yml
          subPath: filebeat.yml
        - name: data
          mountPath: /usr/share/filebeat/data
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
        - name: varlog
          mountPath: /var/log
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: filebeat-config
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
      - name: varlog
        hostPath:
          path: /var/log
      - name: data
        hostPath:
          path: /var/lib/filebeat-data
          type: DirectoryOrCreate
```

```bash
kubectl apply -f filebeat-config.yaml
```

#### 4. Create Log Index Patterns

```bash
# Port forward to Kibana
kubectl port-forward -n logging svc/kibana-kibana 5601:5601

# Open browser to http://localhost:5601
# Navigate to Management > Index Patterns
# Create pattern: hubblewave-logs-*
```

---

## Security Hardening

### 1. Network Policies

```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: hubblewave-api-policy
  namespace: hubblewave-prod
spec:
  podSelector:
    matchLabels:
      app: hubblewave-api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: hubblewave-web
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  - ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
```

### 2. Pod Security Policies

```yaml
# pod-security-policy.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: hubblewave-restricted
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  supplementalGroups:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
  readOnlyRootFilesystem: false
```

### 3. Secrets Management with Vault

```bash
# Install HashiCorp Vault
helm repo add hashicorp https://helm.releases.hashicorp.com
helm install vault hashicorp/vault \
  --namespace vault \
  --create-namespace \
  --set server.ha.enabled=true \
  --set server.ha.replicas=3

# Initialize Vault
kubectl exec -n vault vault-0 -- vault operator init

# Enable Kubernetes auth
kubectl exec -n vault vault-0 -- vault auth enable kubernetes

# Configure Vault
kubectl exec -n vault vault-0 -- vault write auth/kubernetes/config \
  kubernetes_host="https://kubernetes.default.svc:443"

# Create policy for HubbleWave
kubectl exec -n vault vault-0 -- vault policy write hubblewave - <<EOF
path "secret/data/hubblewave/*" {
  capabilities = ["read"]
}
EOF

# Store secrets
kubectl exec -n vault vault-0 -- vault kv put secret/hubblewave/db \
  password="your-db-password"
```

### 4. RBAC Configuration

```yaml
# rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: hubblewave-app
  namespace: hubblewave-prod
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: hubblewave-app-role
  namespace: hubblewave-prod
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: hubblewave-app-binding
  namespace: hubblewave-prod
subjects:
- kind: ServiceAccount
  name: hubblewave-app
  namespace: hubblewave-prod
roleRef:
  kind: Role
  name: hubblewave-app-role
  apiGroup: rbac.authorization.k8s.io
```

### 5. Image Scanning

```bash
# Install Trivy for image scanning
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
sudo apt-get update
sudo apt-get install trivy

# Scan images
trivy image hubblewave/web:latest
trivy image hubblewave/api:latest

# Integrate with CI/CD
# Add to GitHub Actions or GitLab CI
```

---

## Performance Tuning

### 1. Database Connection Pooling

```typescript
// src/config/database.config.ts
import { Pool } from 'pg';

export const dbPool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Connection pool settings
  max: 20,                    // Maximum pool size
  min: 5,                     // Minimum pool size
  idleTimeoutMillis: 30000,   // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if no connection available

  // Performance settings
  statement_timeout: 10000,   // 10 second query timeout
  query_timeout: 10000,

  // SSL for production
  ssl: {
    rejectUnauthorized: true,
    ca: process.env.DB_SSL_CA
  }
});

// Health check
dbPool.on('error', (err, client) => {
  console.error('Unexpected database error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await dbPool.end();
  console.log('Database pool closed');
});
```

### 2. Redis Caching Strategy

```typescript
// src/config/redis.config.ts
import Redis from 'ioredis';

// Redis cluster for high availability
export const redisCluster = new Redis.Cluster([
  {
    host: process.env.REDIS_HOST_1,
    port: parseInt(process.env.REDIS_PORT || '6379')
  },
  {
    host: process.env.REDIS_HOST_2,
    port: parseInt(process.env.REDIS_PORT || '6379')
  },
  {
    host: process.env.REDIS_HOST_3,
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
], {
  redisOptions: {
    password: process.env.REDIS_PASSWORD,
    tls: process.env.NODE_ENV === 'production' ? {} : undefined
  },
  clusterRetryStrategy: (times) => {
    return Math.min(100 * times, 2000);
  }
});

// Cache wrapper with TTL
export class CacheService {
  private static readonly DEFAULT_TTL = 3600; // 1 hour

  static async get<T>(key: string): Promise<T | null> {
    const value = await redisCluster.get(key);
    return value ? JSON.parse(value) : null;
  }

  static async set<T>(key: string, value: T, ttl: number = this.DEFAULT_TTL): Promise<void> {
    await redisCluster.setex(key, ttl, JSON.stringify(value));
  }

  static async del(key: string): Promise<void> {
    await redisCluster.del(key);
  }

  static async invalidatePattern(pattern: string): Promise<void> {
    const keys = await redisCluster.keys(pattern);
    if (keys.length > 0) {
      await redisCluster.del(...keys);
    }
  }
}
```

### 3. API Response Compression

```typescript
// src/middleware/compression.middleware.ts
import compression from 'compression';
import { Request, Response } from 'express';

export const compressionMiddleware = compression({
  filter: (req: Request, res: Response) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Compression level (0-9, 6 is default)
  threshold: 1024, // Only compress responses > 1KB
});
```

### 4. Database Query Optimization

```sql
-- Create indexes for frequently queried columns
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_users_created_at ON users(created_at);
CREATE INDEX CONCURRENTLY idx_projects_owner_id ON projects(owner_id);
CREATE INDEX CONCURRENTLY idx_projects_status ON projects(status);
CREATE INDEX CONCURRENTLY idx_tasks_project_id ON tasks(project_id);
CREATE INDEX CONCURRENTLY idx_tasks_assignee_id ON tasks(assignee_id);

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX CONCURRENTLY idx_users_org_role ON users(organization_id, role);

-- Partial indexes for specific conditions
CREATE INDEX CONCURRENTLY idx_active_users ON users(email) WHERE status = 'active';
CREATE INDEX CONCURRENTLY idx_incomplete_tasks ON tasks(due_date) WHERE status != 'completed';

-- Enable pg_stat_statements for query analysis
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Analyze slow queries
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Vacuum and analyze
VACUUM ANALYZE;

-- Update statistics
ANALYZE;
```

---

## CDN Configuration

### CloudFront Setup (AWS)

```bash
# Create CloudFront distribution (using AWS CLI)
aws cloudfront create-distribution --distribution-config file://cloudfront-config.json
```

**cloudfront-config.json:**
```json
{
  "CallerReference": "hubblewave-prod-2025",
  "Aliases": {
    "Quantity": 2,
    "Items": ["app.hubblewave.com", "cdn.hubblewave.com"]
  },
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 2,
    "Items": [
      {
        "Id": "S3-hubblewave-assets",
        "DomainName": "hubblewave-prod-assets.s3.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": "origin-access-identity/cloudfront/XXXXX"
        }
      },
      {
        "Id": "ALB-hubblewave-api",
        "DomainName": "api.hubblewave.com",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "https-only",
          "OriginSslProtocols": {
            "Quantity": 1,
            "Items": ["TLSv1.2"]
          }
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-hubblewave-assets",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"]
    },
    "CachedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"]
    },
    "Compress": true,
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000,
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    }
  },
  "CacheBehaviors": {
    "Quantity": 1,
    "Items": [
      {
        "PathPattern": "/api/*",
        "TargetOriginId": "ALB-hubblewave-api",
        "ViewerProtocolPolicy": "https-only",
        "AllowedMethods": {
          "Quantity": 7,
          "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
        },
        "CachedMethods": {
          "Quantity": 2,
          "Items": ["GET", "HEAD"]
        },
        "MinTTL": 0,
        "DefaultTTL": 0,
        "MaxTTL": 0,
        "ForwardedValues": {
          "QueryString": true,
          "Cookies": {
            "Forward": "all"
          },
          "Headers": {
            "Quantity": 3,
            "Items": ["Authorization", "Content-Type", "Accept"]
          }
        }
      }
    ]
  },
  "ViewerCertificate": {
    "ACMCertificateArn": "arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT-ID",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "Enabled": true,
  "PriceClass": "PriceClass_All"
}
```

### Cache Invalidation Strategy

```typescript
// src/services/cdn.service.ts
import { CloudFront } from '@aws-sdk/client-cloudfront';

const cloudfront = new CloudFront({ region: 'us-east-1' });

export class CDNService {
  private static readonly DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID!;

  static async invalidatePaths(paths: string[]): Promise<void> {
    await cloudfront.createInvalidation({
      DistributionId: this.DISTRIBUTION_ID,
      InvalidationBatch: {
        CallerReference: `invalidation-${Date.now()}`,
        Paths: {
          Quantity: paths.length,
          Items: paths
        }
      }
    });
  }

  static async invalidateAll(): Promise<void> {
    await this.invalidatePaths(['/*']);
  }

  static async invalidateAssets(): Promise<void> {
    await this.invalidatePaths(['/assets/*', '/static/*']);
  }
}
```

---

## Database Optimization

### 1. Read Replicas Configuration

```sql
-- On primary database
ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET max_wal_senders = 10;
ALTER SYSTEM SET max_replication_slots = 10;
ALTER SYSTEM SET hot_standby = on;

-- Create replication user
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'replicator-password';

-- On replica
-- Edit postgresql.conf
hot_standby = on
max_standby_streaming_delay = 30s

-- Edit recovery.conf
standby_mode = 'on'
primary_conninfo = 'host=primary-db port=5432 user=replicator password=replicator-password'
trigger_file = '/tmp/postgresql.trigger'
```

### 2. Connection Pooling with PgBouncer

```ini
# pgbouncer.ini
[databases]
hubblewave = host=localhost port=5432 dbname=hubblewave

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 10
reserve_pool_size = 5
reserve_pool_timeout = 3
server_lifetime = 3600
server_idle_timeout = 600
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
```

### 3. Automated Backups

```bash
#!/bin/bash
# backup-database.sh

set -e

BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/hubblewave_$TIMESTAMP.sql.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Perform backup
pg_dump -h $DB_HOST -U $DB_USER -d hubblewave | gzip > $BACKUP_FILE

# Upload to S3
aws s3 cp $BACKUP_FILE s3://hubblewave-backups/database/

# Keep only last 30 days of backups locally
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
  echo "Backup successful: $BACKUP_FILE"
else
  echo "Backup failed!"
  exit 1
fi
```

### 4. Database Monitoring Queries

```sql
-- Connection stats
SELECT
  datname,
  numbackends as connections,
  xact_commit as commits,
  xact_rollback as rollbacks,
  blks_read as blocks_read,
  blks_hit as blocks_hit,
  tup_returned as tuples_returned,
  tup_fetched as tuples_fetched
FROM pg_stat_database
WHERE datname = 'hubblewave';

-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Long running queries
SELECT
  pid,
  now() - query_start as duration,
  query,
  state
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - query_start > interval '5 minutes'
ORDER BY duration DESC;
```

---

## Disaster Recovery

### 1. Backup Strategy

**Multi-Tier Backup Approach:**
- **Continuous:** WAL archiving to S3 (15-minute RPO)
- **Daily:** Full database backup at 2 AM UTC
- **Weekly:** Full system snapshot on Sundays
- **Monthly:** Long-term archive retention

### 2. Disaster Recovery Plan

```yaml
# disaster-recovery.yaml
disaster_recovery:
  rto: 1 hour  # Recovery Time Objective
  rpo: 15 minutes  # Recovery Point Objective

  backup_locations:
    primary: us-east-1
    secondary: us-west-2
    tertiary: eu-west-1

  recovery_procedures:
    database:
      - Identify last valid backup
      - Restore from S3 to new RDS instance
      - Apply WAL logs up to failure point
      - Update application connection strings
      - Verify data integrity

    kubernetes:
      - Deploy to standby cluster
      - Restore from etcd backup
      - Update DNS to point to new cluster
      - Verify all pods are running

    application:
      - Deploy latest container images
      - Restore configuration from Git
      - Verify health checks
      - Resume traffic
```

### 3. Disaster Recovery Testing

```bash
#!/bin/bash
# dr-test.sh - Disaster Recovery Test Script

echo "Starting DR test..."

# 1. Take snapshot of current state
kubectl get all -n hubblewave-prod > /tmp/pre-dr-state.txt

# 2. Simulate failure
kubectl scale deployment --all --replicas=0 -n hubblewave-prod

# 3. Wait for pods to terminate
sleep 30

# 4. Restore from backup
kubectl apply -f backup/kubernetes-manifests/

# 5. Wait for pods to be ready
kubectl wait --for=condition=ready pod -l app=hubblewave-api -n hubblewave-prod --timeout=300s

# 6. Verify application health
curl -f https://api.hubblewave.com/health || echo "Health check failed!"

# 7. Compare state
kubectl get all -n hubblewave-prod > /tmp/post-dr-state.txt
diff /tmp/pre-dr-state.txt /tmp/post-dr-state.txt

echo "DR test complete!"
```

### 4. Automated Failover Configuration

```yaml
# Route53 health check and failover (AWS)
Resources:
  HealthCheck:
    Type: AWS::Route53::HealthCheck
    Properties:
      HealthCheckConfig:
        Type: HTTPS
        ResourcePath: /health
        FullyQualifiedDomainName: api.hubblewave.com
        Port: 443
        RequestInterval: 30
        FailureThreshold: 3
      HealthCheckTags:
        - Key: Name
          Value: HubbleWave API Health Check

  PrimaryRecordSet:
    Type: AWS::Route53::RecordSet
    Properties:
      HostedZoneId: Z1234567890ABC
      Name: api.hubblewave.com
      Type: A
      SetIdentifier: Primary
      Failover: PRIMARY
      TTL: 60
      ResourceRecords:
        - 1.2.3.4  # Primary load balancer IP
      HealthCheckId: !Ref HealthCheck

  SecondaryRecordSet:
    Type: AWS::Route53::RecordSet
    Properties:
      HostedZoneId: Z1234567890ABC
      Name: api.hubblewave.com
      Type: A
      SetIdentifier: Secondary
      Failover: SECONDARY
      TTL: 60
      ResourceRecords:
        - 5.6.7.8  # Secondary load balancer IP
```

---

## Mobile App Deployment

### 1. iOS App Store Deployment

```bash
# Build iOS app with Capacitor
cd mobile-app
npm run build
npx cap sync ios
npx cap open ios

# In Xcode:
# 1. Select "Any iOS Device" as target
# 2. Product > Archive
# 3. Validate App
# 4. Distribute App
# 5. Upload to App Store Connect
```

**App Store Connect Configuration:**
- App Name: HubbleWave
- Bundle ID: com.hubblewave.app
- Version: 1.0.0
- Category: Productivity
- Age Rating: 4+
- Privacy Policy URL: https://hubblewave.com/privacy
- Support URL: https://support.hubblewave.com

### 2. Android Play Store Deployment

```bash
# Build Android app
cd mobile-app
npm run build
npx cap sync android
npx cap open android

# In Android Studio:
# 1. Build > Generate Signed Bundle/APK
# 2. Select "Android App Bundle"
# 3. Create or select keystore
# 4. Build release bundle
# 5. Upload to Play Console
```

**Play Console Configuration:**
- Application ID: com.hubblewave.app
- Version Code: 1
- Version Name: 1.0.0
- Category: Productivity
- Content Rating: Everyone
- Privacy Policy: https://hubblewave.com/privacy

### 3. CI/CD for Mobile Apps

```yaml
# .github/workflows/mobile-release.yml
name: Mobile App Release

on:
  push:
    tags:
      - 'mobile-v*'

jobs:
  ios-release:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd mobile-app
          npm ci

      - name: Build web assets
        run: |
          cd mobile-app
          npm run build

      - name: Sync Capacitor
        run: |
          cd mobile-app
          npx cap sync ios

      - name: Build and upload to TestFlight
        run: |
          cd mobile-app/ios/App
          fastlane beta
        env:
          FASTLANE_USER: ${{ secrets.APPLE_ID }}
          FASTLANE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}

  android-release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Setup Java
        uses: actions/setup-java@v3
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Install dependencies
        run: |
          cd mobile-app
          npm ci

      - name: Build web assets
        run: |
          cd mobile-app
          npm run build

      - name: Sync Capacitor
        run: |
          cd mobile-app
          npx cap sync android

      - name: Build and upload to Play Store
        run: |
          cd mobile-app/android
          fastlane beta
        env:
          PLAY_STORE_JSON_KEY: ${{ secrets.PLAY_STORE_JSON_KEY }}
```

---

## Post-Deployment Checklist

### Infrastructure
- [ ] Kubernetes cluster running and healthy
- [ ] All pods deployed and ready
- [ ] Load balancer configured with health checks
- [ ] DNS records updated and propagating
- [ ] SSL certificates installed and valid
- [ ] Monitoring dashboards accessible
- [ ] Log aggregation collecting logs
- [ ] Backup jobs running successfully

### Security
- [ ] Network policies enforced
- [ ] RBAC configured correctly
- [ ] Secrets stored securely
- [ ] Security scanning enabled
- [ ] WAF rules active
- [ ] SSL/TLS A+ rating verified
- [ ] Security headers configured
- [ ] Vulnerability scan passed

### Performance
- [ ] CDN serving static assets
- [ ] Database connection pooling active
- [ ] Redis caching operational
- [ ] Compression enabled
- [ ] Lighthouse score 95+
- [ ] Load testing completed
- [ ] Auto-scaling tested
- [ ] Query performance optimized

### Disaster Recovery
- [ ] Backup automation verified
- [ ] Restore procedure tested
- [ ] Failover configuration active
- [ ] DR runbook documented
- [ ] Team trained on procedures
- [ ] Off-site backups confirmed
- [ ] Recovery metrics met (RTO/RPO)

### Mobile Apps
- [ ] iOS app submitted to App Store
- [ ] Android app submitted to Play Store
- [ ] App Store Optimization completed
- [ ] Beta testing program active
- [ ] Push notifications configured
- [ ] Deep linking tested
- [ ] Crash reporting enabled
- [ ] Analytics tracking verified

---

**Document Version:** 1.0
**Last Updated:** 2025-12-30
**Next Review:** Post-Launch +7 days
