#!/bin/bash
set -e

# NO manual gcloud auth activation — rely on ADC automatic flow

exec "$@"
