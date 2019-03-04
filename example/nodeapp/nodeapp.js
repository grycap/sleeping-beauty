/*
#
# sleeping beauty - a system that helps to implement serverless infrastructures
#
# https://github.com/grycap/sleeping-beauty
#
# Copyright (C) GRyCAP - I3M - UPV 
# Developed by Carlos A. caralla@upv.es
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
*/
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
server.listen(port);