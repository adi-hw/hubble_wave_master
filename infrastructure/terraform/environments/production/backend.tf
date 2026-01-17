terraform {
  backend "s3" {
    bucket         = "hubblewave-terraform-state"
    key            = "control-plane/terraform.tfstate"
    region         = "us-east-2"
    dynamodb_table = "hubblewave-terraform-locks"
    encrypt        = true
  }
}
