# The Sleeping Beauty - Serverless for General Virtual Infrastructures

The sleeping beauty is a system that helps to implement serverless infrastructures: you have the servers aslept (or not even created), and they are awaken (or created) as they are needed. Later, they go back to sleep (or they are disposed).

The name for this project is "the sleeping beauty", because of the tale. It is like having a sleeping virtual infrastructure (i.e. the _sleeping beauty_), that will be awaken as an incoming connection (i.e. a _kiss_) was received from the user (i.e. the _prince_).

If you want to know about the underlying technology used in the _sleeping beauty_ please refer to [this blog post](https://ilearnedhowto.wordpress.com/2019/02/27/how-to-dynamically-create-on-demand-services-to-respond-to-incoming-tcp-connections/).

## 1. The problem

The original problem was to have a VM that was powered off, and start it whenever an incoming ssh connection was received, and then forward the network traffic to that VM to serve the ssh request. In this way, I could have a server in a cloud provider (e.g. Amazon), and not to spend money if I was not using it.

## 2. The Sleeping Beauty

The _Sleeping Beauty_ is a system that listens for incoming TCP connections, spawns servers to serve them, and redirects the network traffic to the selected server.

> The effect for the client is that the server was always available (although it was actually not available, and the sleeping beauty has awaken it upon the connection).

Using the _Sleeping Beauty_, you can 
1. Configure services that listen to a port.
2. Configure the commands that start your effective services, check the status or stop them. 
3. Activate an idle-detection mechanism that is able to check whether the effective service is idle, and if it has been idle for a period of time, stop it to save resources.

---
**Example**
1. Listen in port 22
2. Define the commands
    * Command to start the service: Spawn a VM in Amazon AWS
    * Command to check the status: Check whether the VM is running or not.
    * Command to stop the service: Stop the VM from Amazon AWS.
3. Define a command to check idleness: SSH to the VM and issue the command "who".

---

The commands that start, stop, check the status or idleness of the services are arbitrary. It is even possible to create multiple instances of services and select which one has to serve each request (e.g. depending on the source IP address or port, or the load of the service). The command that creates the service just has to return the destination for the received request in the form of `IP PORT`, in the stdout.

## 3. Installation

You can get the proper package (rpm or deb) from the [releases page](https://github.com/grycap/sleeping-beauty/releases), or you can get the source code and start using it without the need of installing it.

### From packages

**Ubuntu**

```console
$ apt update
$ wget https://github.com/dealfonsoc/sleeping-beauty/releases/download/1.0-beta0/sleepingd_1.0-beta0.deb
$ apt install ./sleepingd_1.0-beta0.deb
```

**CentOS**

```console
$ wget https://github.com/dealfonsoc/sleeping-beauty/releases/download/1.0-beta0/sleepingd-1.0-beta0.noarch.rpm
$ yum install ./sleepingd-1.0-beta0.noarch.rpm
```

### From source

**Dependencies**

Install the latest release of `bashc` from [this repository](https://github.com/dealfonso/bashc).

Now install the rest of the dependencies

**Ubuntu**

```console
$ apt update
$ apt install bash tar coreutils gettext-base gawk sed socat procps login netcat
```

**CentOS**
```console
$ yum install bash tar coreutils gawk gettext socat util-linux procps-ng nc
```

Now get the code, compile it and use it

```
$ git clone https://github.com/dealfonso/sleeping-beauty
$ cd sleeping-beauty
$ bashc -c sleeping-beauty.bashc -o sleepingd
$ ./sleepingd start
```

### Testing

```console
$ sleepingd --version
1.0-beta0
$ sleepingd start
Simple web server for testing purposes (port 10080) started
$ curl http://localhost:10080
Response from 8080: Fri Mar  1 12:10:37 UTC 2019
```

## 4. Examples

There are some examples shipped with the standard installation of the _sleeping beauty_. In this section we 

### 4.1 Simple web server for testing purposes

This is a very simple example in which the _sleeping beauty_ listens in port 10080 for incoming connections and, when it receives one, it starts a dumb web server in port 8080 that simply outputs the string "Response from 8080: \<current date\>".

The web server is implemented by a simple call to the classic `netcat` command, in the following manner:

```console
echo -e "Response from 8080" | nc -l -p 8080
```

You can try this command, and (in other term), check the output of

```console
# wget -q -O- localhost:8080
Response from 8080
```

The configuration for this simple web server that is started on demand consist in the next lines:

```ini
[Simple web server for testing purposes]
# - The service is not active
ACTIVE=yes
# - The port in which the sleeping beauty will listen is 10080
PORT=10080
# - The command that spawns the server is a dumb web server
START_CMD="( echo -e 'Response from 8080: $(date)' | nc -l -p 8080 -w 1 > /dev/null 2> /dev/null & ) ; echo '127.0.0.1 8080'"
```

> The option `-w 1` is added to the web server to die after 1 second without any network activity, to verify that the server is spawned on demand.

### Testing

First we'll edit file `/etc/sleepingd/sleepingd.conf` and will include the previous configuration (it is included in the default installation).

Now we'll check that there is not any server listening in 10080:

```console
# sleepingd stop
# wget -q -O- localhost:10080 -t 1
#  
```

We get no output. Now we start the sleeping beauty and will check for the connection with the port:

```console
# sleepingd start
Simple web server for testing purposes (port 10080) started
# wget -q -O- localhost:10080 -t 1
Response from 8080: Fri Mar  1 21:50:03 UTC 2019
# wget -q -O- localhost:8080 -t 1
```

We can see that the server is spawned (it responded), but now there is not any webserver at that port because it was closed.

### 4.2 A nodejs application in Docker containers

This is a full complex example:
- The sleeping beauty listens in port 20080 for incoming connections. 
- Upon receving a connection, the _sleeping beauty_ will start a Docker container (if needed), to serve the request.
- The Docker container is a simple NodeJS application that listens in port 3000 (or the port defined in the PORT env variable when node is started).
- We'll have a pool of two Docker containers to server the requests.
- The requests are assigned to each Docker container randomly.
- When the Docker containers have been running for 20 seconds, they are deleted (this is only to demonstrate the possibility of creating ephemeral servers, and the start of these servers on demand).

#### The nodejs app in a Docker container

First we create a nodejs application and put it into a Docker container. The application is included in `/usr/share/sleepingd/example/nodeapp`. It consists of a single file `nodeapp.js` and the file `package.json` that describes it.

**nodeapp.js**

```javascript
var http = require('http');
var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
  res.send(`response from ${req.socket.localAddress}:${req.socket.localPort}`);
});

var app = express();
app.use('/', router);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  res.status(404).send('Not found');
});

var port = process.env.PORT || '3000';
var server = http.createServer(app);
server.listen(port);```
```

We need to create the Docker container that contains that application:

```console
# cd /usr/share/sleepingd/example
# docker build . -t sleepingnode
```

We can test the application

```console
# docker run --rm -id -p 3000:3000 --name sleepingnode1 sleepingnode
# wget -q -O- http://localhost:3000 -t 1
response from ::ffff:172.17.0.6:3000
# docker stop sleepingnode1
sleepingnode1
```

#### The script that starts and stops the servers

Now we need a script that starts, stops and checks the status of the servers. It is included in `/usr/share/sleepingd/example/startserver`.

That scripts respond to 3 commands:
* _start_: assigns the connection to the container named `sleepingnode1` or to `sleepingnode2`. If the container is not running, it will start the container and expose the port. Then it returns in the stdout the IP address of the container and the port to which the connection is assigned.
* _status_: checks if any of the possible container is running. If (at least) one of them is running, it will return `true` (0).
* _stop_: stops all the possible containers.

> You are invited to inspect the script for further details.

#### The configuration for the sleeping beauty

The fragment to configure this example in the _sleeping beauty_ is the next. It is shipped in the standard configuration file, and you just need to activate it (setting `ACTIVE=yes` in the proper section).

```ini
[Nodeapp in docker containers]
# Now the service is active
ACTIVE=yes
# The port in which we want the service to listen
PORT=20080
# The command to start the effective servers
START_CMD="/usr/share/sleepingd/example/startserver start"
# The command to stop the effective servers
STOP_CMD="/usr/share/sleepingd/example/startserver stop"
# The command that checks wether the servers are idle or not
IDLE_CMD="/usr/share/sleepingd/example/startserver status"
# Tell the sleeping beauty to stop the servers after 20 seconds of being idle
IDLE_TIME=20
# Check for idleness each 5 seconds
IDLE_CHECK_INTERVAL=5
```

#### Testing

First we can check that there is not any running container, and we have not anything listening in port 20080.

```console
# docker ps
CONTAINER ID        IMAGE               COMMAND             CREATED             STATUS              PORTS               NAMES
# sleepingd stop
# wget -q -O- http://localhost:20080 -t 1
#
```

Now we need to the service in the default configuration file shipped with the sleeping beauty, by setting `ACTIVE=yes` where appropriate. And then, start the sleeping beauty, get the web page and check that a container has started.

```console
# sleepingd start
# wget -q -O- http://localhost:20080
response from ::ffff:172.17.0.5:3000
# docker ps
CONTAINER ID        IMAGE               COMMAND                  CREATED             STATUS              PORTS                    NAMES
a6f871f79bf0        sleepingnode        "/bin/sh -c 'npm sta…"   7 seconds ago       Up 6 seconds                                 sleepingnode1
```

Now we can wait for 20 seconds and see that the containers have been properly stopped.

```console
# docker ps
CONTAINER ID        IMAGE               COMMAND             CREATED             STATUS              PORTS               NAMES
```

Please feel free to use wget more times to spawn multiple Docker containers, and use `docker ps` to see that they are created and disposed.


## 5. Configuration options

The configuration file consist of a general section, in which it is possible to define values that are inherited for any service (e.g. EXEC_CMD_TIMEOUT that defines a timeout for the executions of commands before considering that they have failed).

After the general section, each service is included in a section with the notation `[section]`. The name for the service will be the name of the section.

In each section it is possible to define any of the parameters.

### Parameters

* ACTIVE (Default: yes): Whether the service is active or not. The default value for the main section is 'no' but the default value for the other sections is 'yes'.

* PORT (Default: none): Port in which the meta-server will be listening for connections. (*) Please do not confuse with the ports in which the effective services will be listening.

* CHECK_CMD (Default: false): Command that checks if the service is available or not (whether it needs to execute the start command or not). It is called when an incoming connection is detected.

* START_CMD (Default: false): Command that starts the service (it returns an IP address and a port to which redirect the traffic). It is called when an incoming connection is detected and the execution of the CHECK_CMD fails.

* STOP_CMD (Default: false): Command that stops the service. It is called when the sleeping service is stopped

* EXEC_CMD_TIMEOUT (Default: blank): General timeout when executing a command. Blank means no timeout.

* START_CMD_TIMEOUT (Default: blank): Timeout when executing the start command. Blank means no timeout.

* STOP_CMD_TIMEOUT (Default: blank): Timeout when executing the stop command. Blank means no timeout.

* CHECK_CMD_TIMEOUT (Default: blank): Timeout when executing the check command. Blank means no timeout.

* IDLE_CMD_TIMEOUT (Default: blank): Timeout when executing the idle command. Blank means no timeout.

* USER (Default: blank): User that will listen for the incoming connection (thus the one that runs the commands). Blank means the current user
* IDLE_CHECK_INTERVAL (Default: blank): Period of time (in seconds) to execute the IDLE_CMD. 0 or blank will mean "deactivated"
* IDLE_TIME (Default: blank): Period of time after a service that has been reported to be idle, is considered to be efectively idle.
* IDLE_CMD (Default: true): Command that is executed to detect wether the infrastructure is idle or not. If it is reported to be idle for a period of time determined in variable IDLE_TIME, the command STOP_CMD will be executed, to stop the service. Blank means "deactivated"
