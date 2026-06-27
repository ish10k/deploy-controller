package main

import (
	"os"

	"github.com/onerelease/deploy-controller/cli/internal/cli"
)

func main() {
	os.Exit(cli.Run(os.Args[1:], os.Getenv, os.Stdout, os.Stderr))
}
