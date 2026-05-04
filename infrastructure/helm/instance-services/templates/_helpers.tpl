{{- define "instance-services.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "instance-services.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "instance-services.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels applied to every object.
*/}}
{{- define "instance-services.labels" -}}
helm.sh/chart: {{ include "instance-services.chart" . }}
app.kubernetes.io/name: {{ include "instance-services.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: hubblewave-platform
hubblewave.com/environment: {{ .Values.environment | quote }}
{{- if .Values.customerCode }}
hubblewave.com/customer-code: {{ .Values.customerCode | quote }}
{{- end }}
{{- if .Values.instanceId }}
hubblewave.com/instance-id: {{ .Values.instanceId | quote }}
{{- end }}
{{- end -}}

{{/*
Selector labels for a single service in the bundle.
Usage: {{ include "instance-services.serviceSelector" (dict "root" . "service" $svc) }}
*/}}
{{- define "instance-services.serviceSelector" -}}
app.kubernetes.io/name: {{ include "instance-services.name" .root }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .service.name }}
{{- end -}}

{{- define "instance-services.secretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- else -}}
{{- printf "%s-secrets" (include "instance-services.fullname" .) -}}
{{- end -}}
{{- end -}}

{{/*
Resolve the image reference for a service entry.
Usage: {{ include "instance-services.image" (dict "root" . "service" $svc) }}
*/}}
{{- define "instance-services.image" -}}
{{- $registry := .root.Values.image.registry -}}
{{- $repo := .root.Values.image.repository -}}
{{- $tag := .root.Values.image.tag | default "" -}}
{{- if not $tag -}}
{{- fail "image.tag must be set (CD passes the commit SHA via --set image.tag)" -}}
{{- end -}}
{{- printf "%s/%s/%s:%s" $registry $repo .service.image $tag -}}
{{- end -}}

{{/*
Coalesce a per-service field with the chart-wide default.
Usage: {{ include "instance-services.coalesce" (dict "service" $svc "default" $default "key" "replicaCount") }}
*/}}
{{- define "instance-services.coalesce" -}}
{{- $svcVal := index .service .key -}}
{{- $defVal := index .default .key -}}
{{- if hasKey .service .key -}}
{{- toYaml $svcVal -}}
{{- else -}}
{{- toYaml $defVal -}}
{{- end -}}
{{- end -}}
