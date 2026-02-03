# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in mcp-zoekt, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email the maintainer directly at the email associated with the repository
3. Include a detailed description of the vulnerability
4. If possible, include steps to reproduce the issue

### What to expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
- **Assessment**: We will assess the vulnerability and determine its severity
- **Fix timeline**: Critical vulnerabilities will be addressed within 7 days; others within 30 days
- **Disclosure**: We will coordinate with you on public disclosure after a fix is available

## Security Best Practices

When deploying mcp-zoekt:

### Network Security
- Run Zoekt webserver on an internal network, not exposed to the public internet
- Use HTTPS for HTTP transport mode in production
- Consider using a reverse proxy with authentication for remote access

### Access Control
- The MCP server provides read-only access to indexed code
- Ensure your Zoekt index only contains repositories you want to expose
- Review indexed repository contents before deployment

### Docker Deployment
- Use the provided non-root user (mcpuser) in the container
- Mount volumes read-only when possible
- Keep the Docker image updated

### Environment Variables
- Store sensitive configuration (if any) in environment variables, not command-line arguments
- Use secrets management in production Kubernetes/Docker Swarm deployments

## Dependencies

We monitor dependencies for known vulnerabilities using:
- npm audit (run with `npm audit`)
- Dependabot alerts on GitHub

Report any dependency-related security concerns through the same process as above.
