# HubbleWave Network Policies

This directory contains Kubernetes NetworkPolicy resources that enforce egress restrictions for HubbleWave services. These policies implement the principle of least privilege at the network layer.

## Canon Compliance

These network policies enforce architectural principles defined in the HubbleWave Canon:

| Canon Section | Principle | Implementation |
|---------------|-----------|----------------|
| Section 9: Authorization Is Centralized | All data access flows through centralized rules with no shortcuts | Default deny egress ensures all external access must be explicitly authorized |
| Section 11: AI Is Infrastructure | AVA is a reasoning layer over platform state | AVA pods have no external network access; they operate exclusively on internal platform APIs |
| Section 12: Trust Is Earned Incrementally | AVA progression: Suggest, Preview, Approve, Execute, Audit | AVA network isolation prevents unaudited external actions |

## Policy Overview

### default-deny-egress.yaml

Establishes the baseline security posture for the namespace:

- **default-deny-egress**: Denies all egress from all pods by default
- **allow-dns-egress**: Permits DNS resolution to CoreDNS for all pods
- **allow-internal-cluster-egress**: Permits internal cluster communication (service mesh, monitoring, databases)

### connector-egress-policy.yaml

Grants external network access exclusively to connector services:

- Applies to pods with label `app=svc-connectors`
- Permits HTTPS/HTTP egress to external systems (0.0.0.0/0)
- Permits internal cluster communication
- Connectors are the designated integration boundary for external systems

### ava-deny-egress-policy.yaml

Explicitly restricts AVA to internal-only communication:

- Applies to pods with label `app=svc-ava`
- Permits only internal cluster communication
- Denies all external egress
- AVA accesses external systems exclusively through the connector service

## Service Egress Matrix

| Service | Internal Cluster | External HTTPS | External HTTP | Rationale |
|---------|------------------|----------------|---------------|-----------|
| svc-connectors | Yes | Yes | Yes | Integration boundary for external systems |
| svc-ava | Yes | No | No | Reasoning layer operates on internal state only |
| svc-api | Yes | No | No | API gateway; external access via connectors if needed |
| svc-workflow | Yes | No | No | Workflow engine; external access via connectors |
| svc-automation | Yes | No | No | Automation rules; external access via connectors |
| All other pods | Yes | No | No | Default internal-only communication |

## Applying the Policies

### Prerequisites

- Kubernetes cluster with a CNI that supports NetworkPolicy (Cilium or Calico)
- `kubectl` configured with cluster access
- Namespace `hubblewave` must exist with appropriate labels

### Label the Namespace

```bash
kubectl label namespace hubblewave kubernetes.io/metadata.name=hubblewave
```

### Apply Policies in Order

Apply the default deny policy first, then service-specific policies:

```bash
# Apply default deny (establishes baseline)
kubectl apply -f default-deny-egress.yaml

# Apply service-specific policies
kubectl apply -f connector-egress-policy.yaml
kubectl apply -f ava-deny-egress-policy.yaml
```

### Verify Policy Application

```bash
kubectl get networkpolicies -n hubblewave
```

Expected output:

```
NAME                           POD-SELECTOR       AGE
default-deny-egress            <none>             1m
allow-dns-egress               <none>             1m
allow-internal-cluster-egress  <none>             1m
connector-egress-policy        app=svc-connectors 1m
ava-deny-egress-policy         app=svc-ava        1m
```

## Testing Policies

### Verify AVA Cannot Reach External Networks

```bash
kubectl exec -n hubblewave -it $(kubectl get pod -n hubblewave -l app=svc-ava -o jsonpath='{.items[0].metadata.name}') -- curl -v --connect-timeout 5 https://example.com
```

Expected: Connection timeout or refused.

### Verify Connectors Can Reach External Networks

```bash
kubectl exec -n hubblewave -it $(kubectl get pod -n hubblewave -l app=svc-connectors -o jsonpath='{.items[0].metadata.name}') -- curl -v --connect-timeout 5 https://example.com
```

Expected: Successful connection.

### Verify Internal Communication Works

```bash
kubectl exec -n hubblewave -it $(kubectl get pod -n hubblewave -l app=svc-ava -o jsonpath='{.items[0].metadata.name}') -- curl -v --connect-timeout 5 http://svc-api.hubblewave.svc.cluster.local:8080/health
```

Expected: Successful connection.

## CNI Compatibility

These policies use standard Kubernetes NetworkPolicy resources and are compatible with:

- **Cilium**: Full support including all selectors and CIDR blocks
- **Calico**: Full support including all selectors and CIDR blocks
- **Weave Net**: Basic support; verify CIDR block handling

For advanced features (L7 filtering, DNS-based policies), consider Cilium CiliumNetworkPolicy or Calico GlobalNetworkPolicy resources.

## Troubleshooting

### Pods Cannot Resolve DNS

Verify the kube-system namespace has the expected label:

```bash
kubectl label namespace kube-system kubernetes.io/metadata.name=kube-system
```

### Service Mesh Communication Failing

If using Istio, verify the istio-system namespace has the expected label:

```bash
kubectl label namespace istio-system kubernetes.io/metadata.name=istio-system
```

### Monitoring Not Receiving Metrics

Verify the monitoring namespace has the expected label:

```bash
kubectl label namespace monitoring kubernetes.io/metadata.name=monitoring
```

## Modifying Policies

When modifying these policies:

1. Ensure changes align with Canon principles (especially Sections 9, 11, and 12)
2. Document the rationale for any new egress rules
3. Test in a non-production environment before applying to production
4. Update the Service Egress Matrix in this document
