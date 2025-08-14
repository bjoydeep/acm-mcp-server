# Use OpenResty (nginx + lua) for token validation
FROM openresty/openresty:alpine

# Install curl for HTTP calls (simpler than lua-resty-http)
RUN apk add --no-cache curl

# Copy configuration and auth script
COPY nginx.conf /usr/local/openresty/nginx/conf/nginx.conf
COPY auth.lua /etc/nginx/auth.lua

# Create necessary temp and log directories
RUN mkdir -p /usr/local/openresty/nginx/client_body_temp \
             /usr/local/openresty/nginx/proxy_temp \
             /usr/local/openresty/nginx/fastcgi_temp \
             /usr/local/openresty/nginx/uwsgi_temp \
             /usr/local/openresty/nginx/scgi_temp \
             /usr/local/openresty/nginx/logs \
             /tmp && \
    chmod -R 777 /usr/local/openresty/nginx/ \
                 /tmp

# Run as root for now (OpenShift will apply security constraints)
# USER root is implicit

# Expose port
EXPOSE 8080

# Start nginx
CMD ["/usr/local/openresty/bin/openresty", "-g", "daemon off;"]