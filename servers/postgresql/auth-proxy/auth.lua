local cjson = require "cjson"

local function validate_bearer_token(token)
    -- Remove 'Bearer ' prefix
    if not token or not string.match(token, "^Bearer ") then
        return false, "Invalid Bearer token format"
    end
    
    local auth_token = string.sub(token, 8)  -- Remove 'Bearer ' (7 chars + space)
    
    -- Read service account token for API calls
    local sa_token_file = io.open("/var/run/secrets/kubernetes.io/serviceaccount/token", "r")
    if not sa_token_file then
        return false, "Service account token not found"
    end
    local sa_token = sa_token_file:read("*all")
    sa_token_file:close()
    
    -- Kubernetes API URL
    local k8s_host = os.getenv("KUBERNETES_SERVICE_HOST") or "kubernetes.default.svc.cluster.local"
    local k8s_port = os.getenv("KUBERNETES_SERVICE_PORT") or "443"
    local k8s_url = "https://" .. k8s_host .. ":" .. k8s_port
    
    -- Create TokenReview request JSON
    local token_review_json = cjson.encode({
        apiVersion = "authentication.k8s.io/v1",
        kind = "TokenReview",
        spec = {
            token = auth_token
        }
    })
    
    -- Write request to temp file
    local temp_file = "/tmp/token_review_" .. ngx.worker.pid() .. ".json"
    local f = io.open(temp_file, "w")
    if not f then
        return false, "Could not create temp file"
    end
    f:write(token_review_json)
    f:close()
    
    -- Make TokenReview API call using curl
    local curl_cmd = string.format(
        'curl -s -k --max-time 5 -X POST "%s/apis/authentication.k8s.io/v1/tokenreviews" ' ..
        '-H "Authorization: Bearer %s" ' ..
        '-H "Content-Type: application/json" ' ..
        '-H "Accept: application/json" ' ..
        '--data @%s',
        k8s_url, sa_token, temp_file
    )
    
    local handle = io.popen(curl_cmd)
    if not handle then
        os.remove(temp_file)
        return false, "Failed to execute curl"
    end
    
    local response_body = handle:read("*all")
    local success, exit_code = handle:close()
    
    -- Clean up temp file
    os.remove(temp_file)
    
    if not success or not response_body or response_body == "" then
        return false, "Failed to validate token: curl failed"
    end
    
    -- Parse response
    local ok, token_review_response = pcall(cjson.decode, response_body)
    if not ok then
        return false, "Failed to parse TokenReview response"
    end
    
    if token_review_response.status and token_review_response.status.authenticated then
        return true, token_review_response.status.user
    else
        return false, "Token not authenticated"
    end
end

-- Main auth function called by nginx
local auth_header = ngx.var.http_authorization

if not auth_header then
    ngx.status = 401
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode({error = "Missing Authorization header"}))
    return
end

local valid, user_or_error = validate_bearer_token(auth_header)

if not valid then
    ngx.status = 403
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode({error = user_or_error}))
    return
end

-- Success - set user headers for upstream
if type(user_or_error) == "table" then
    if user_or_error.username then
        ngx.header["X-Remote-User"] = user_or_error.username
    end
    if user_or_error.uid then
        ngx.header["X-Remote-User-UID"] = user_or_error.uid
    end
    if user_or_error.groups then
        ngx.header["X-Remote-Groups"] = table.concat(user_or_error.groups, ",")
    end
end

-- Allow request to proceed
ngx.status = 200
ngx.exit(200)