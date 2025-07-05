# OAuth Authentication flow

```plantuml

box PhotoClove
participant localForage
participant MainLogic as PhotoClove
end box
participant Browser
box AuthServer
participant AuthServer
participant Storage
end box
participant Google


PhotoClove->AuthServer: localhost:port & $random_string
AuthServer->Storage: store $random_string\nwith ocalhsot:port
Storage-->AuthServer:
AuthServer-->PhotoClove: 200 OK
PhotoClove->Browser: open Google
Browser->Google: OAuth2.0 request (/code/, response_type = offline, token_type = code)
note right: state is $random_string\nredirect_url is \nhttps://AuthServer/get_access_token/
Google->Google: SignIn
Google-->Browser: Redirect to https://AuthServer/get_access_token/
Browser->AuthServer: /get_access_token?state=$random_string&....
note right: state is included in URL
AuthServer->Storage: get localhost:port\nwith state $random_string
Storage-->AuthServer: localhost:port
AuthServer->Google: get access_token
Google-->AuthServer: access_token & refresh_token
AuthServer->Browser: Redirect to localhost:port/save_token
Browser->PhotoClove
note left:access_token &\n refresh_token
PhotoClove->localForage: store tokens
localForage-->PhotoClove
PhotoClove-->Browser: show message "Close Window"

```