{{/*
Expand the name of the chart.
*/}}
{{- define "control-plane.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a fully qualified app name for the release.
*/}}
{{- define "control-plane.fullname" -}}
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

{{- define "control-plane.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels applied to every object.
*/}}
{{- define "control-plane.labels" -}}
helm.sh/chart: {{ include "control-plane.chart" . }}
app.kubernetes.io/name: {{ include "control-plane.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: hubblewave-platform
hubblewave.com/environment: {{ .Values.environment | quote }}
{{- end -}}

{{/*
Selector labels for a given component (api or web).
Usage: {{ include "control-plane.selectorLabels" (dict "root" . "component" "api") }}
*/}}
{{- define "control-plane.selectorLabels" -}}
app.kubernetes.io/name: {{ include "control-plane.name" .root }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/*
Resolve the secret name (either an existing one or the chart-managed default).
*/}}
{{- define "control-plane.secretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- else -}}
{{- printf "%s-secrets" (include "control-plane.fullname" .) -}}
{{- end -}}
{{- end -}}

{{/*
Resolve the fully-qualified image reference for a component.
The CD pipeline pins image.tag to a commit SHA so digest substitution remains intact.
Usage: {{ include "control-plane.image" (dict "root" . "component" .Values.api.image.component) }}
*/}}
{{- define "control-plane.image" -}}
{{- $registry := .root.Values.image.registry -}}
{{- $repo := .root.Values.image.repository -}}
{{- $tag := .root.Values.image.tag | default "" -}}
{{- if not $tag -}}
{{- fail "image.tag must be set (CD passes the commit SHA via --set image.tag)" -}}
{{- end -}}
{{- printf "%s/%s/%s:%s" $registry $repo .component $tag -}}
{{- end -}}
