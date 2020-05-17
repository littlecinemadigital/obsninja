/*
*  Copyright (c) 2020 Steve Seguin. All Rights Reserved.
*
*  Use of this source code is governed by the APGLv3 open-source license
*  that can be found in the LICENSE file in the root of the source
*  tree. Alternative licencing options can be made available on request.
*
*/
/*jshint esversion: 6 */
var WebRTC = {}; 
function log(msg){
	//console.log(msg);
	//console.re.log(msg);
}
function errorlog(msg, url=false, lineNumber=false){

	//console.error(msg);
	//console.re.error(msg);
	if (lineNumber){
	//	console.re.error(lineNumber);
	//	console.error(lineNumber);
	}
}
function isAlphaNumeric(str) {
	var code, i, len;

	for (i = 0, len = str.length; i < len; i++) {
		code = str.charCodeAt(i);
		if (!(code > 47 && code < 58) && // numeric (0-9)
			!(code > 64 && code < 91) && // upper alpha (A-Z)
			!(code > 96 && code < 123)) { // lower alpha (a-z)
			return false;
		}
	}
	return true;
}
window.onerror = function backupErr(errorMsg, url, lineNumber) {
	errorlog(errorMsg);
	errorlog(lineNumber);
	errorlog("Unhandeled Error occured"); //or any message
	return false;
};

WebRTC.Media = (function webrtcmediamain(){
	var session = {};
	
	function onSuccess(){}
	function onError(err){errorlog(err);}
	function defer(){
		var res, rej;
		var promise = new Promise((resolve, reject) => {
			res = resolve;
			rej = reject;
		});
		promise.resolve = res;
		promise.reject = rej;
		return promise;
	}

	session.configuration = 
		{iceServers: [
		{ urls: ["stun:stun.l.google.com:19302", "stun:stun4.l.google.com:19302" ]},
		{ urls: ["stun:stun.stunprotocol.org:3478"]}
		]};
	//var turn = {};
	//turn.username = "steve";
	//turn.credential = "justtesting";
	//turn.urls = ["turn:turn.obs.ninja:443"];
	//session.configuration.iceServers.push(turn);
	var AudioContext = window.AudioContext || window.webkitAudioContext;
	log(session.configuration);
    session.audio = true; // should we ask peer for audio
	session.bitrate = false; // 20000;
	session.buffer = false;
	session.codec = false ; // "vp9" //"h264"; // Setting the default codec to VP9?  ugh. Seems stable, but high CPU.
	session.counter=0; // this keeps track of messages sent. Lets the listener know if he missed any signed messages. security aspect.
	session.director = false;
	session.enc = new TextEncoder("utf-8");
	session.framerate = false;
	session.focusDistance = false;
	session.height=false;
	session.infocus = false;
	session.keys = {}; // security signing stuff
	session.maxframerate = false;
	session.msg = null;
	session.muted = false;
	session.mykey = {};
	session.nocursor = false;
	session.disableOBS = false;
	session.pcs = {};
	session.remote = false;
	session.roomid = false;
	session.rpcs = {};
	session.scene = false;
	session.screenshare = false;
	session.security = false;
	session.sink  = false;
	session.stereo = false; // both peers need to have this enabled for it to work.
	session.streamID = null; // This computer has its own streamID; this implies it can only publish 1 stream per session.
	session.streamSrc = null; // location of this computer's stream, if there is one
	session.sync = false;
	session.video = true; // should we ask peer for video
	session.videoElement = false;
	session.videoMuted = false;
	session.view = false;
	session.volume = 100; // state of volume.
	session.width=false;
	session.zoom=false;

	//this._peerConnection.getReceivers().forEach(element => element.playoutDelayHint = 0.05);
	
	session.generateStreamID = function generatestreamidfunc(){
		var text = "";
		var possible = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
		for (var i = 0; i < 7; i++){
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		log(text);
		return text;
	};

	session.changeStreamID = function(permaid){
		permaid = permaid.replace(/[^0-9a-zA-Z]/gi, '');
		if (permaid.length < 1){
			alert("permaid URL parameter should be at least 7 alphanumeric characters long");			          
		} else if  (permaid.length > 25){
			alert("permaid URL parameter should be less than 21 alphanumeric characters long");
		} else {
			session.streamID = permaid;
		}
	};

	session.generateCrypto = function generatecryptofunc(){
		window.crypto.subtle.generateKey({
			name: "RSASSA-PKCS1-v1_5",
			modulusLength: 512, //can be 1024, 2048, or 4096 -- also apparently 512!
			publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
			hash: {name: "SHA-1"}, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
		},
			true, //whether the key is extractable (i.e. can be used in exportKey)
			["sign", "verify"] //can be any combination of "sign" and "verify"
		).then(function(key){
			log(key.publicKey);
			log(key.privateKey);
			session.mykey = key;

			window.crypto.subtle.exportKey(
				"jwk", //can be "jwk" (public or private), "spki" (public only), or "pkcs8" (private only)
				key.publicKey //can be a publicKey or privateKey, as long as extractable was true
			).then(function(keydata){
				//returns the exported key data
				log(keydata);
				var data = {};
				data.request = "storekey";
				data.key = keydata.n;
				session.sendMsg(data);
				//log(JSON.stringify(data));
				//session.signData("asdfasdfasdf");
			}).catch(function(err){
				errorlog(err);
			});
		})
			.catch(function(err){
				errorlog(err);
			});
	};

	session.importCrypto = function(n,streamID){
		window.crypto.subtle.importKey(
			"jwk", //can be "jwk" (public or private), "spki" (public only), or "pkcs8" (private only)
			{   //this is an example jwk key, other key types are Uint8Array objects
				kty: "RSA",
				e: "AQAB",
				n: n,
				alg: "RS1",
				ext: true,
			},
			{   //these are the algorithm options
				name: "RSASSA-PKCS1-v1_5",
				hash: {name: "SHA-1"}, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
			},
			true, //whether the key is extractable (i.e. can be used in exportKey)
			["verify"] //"verify" for public key import, "sign" for private key imports
		).then(function(publicKey){
			//returns a publicKey (or privateKey if you are importing a private key)
			log(publicKey);
			session.keys[streamID] = {};
			session.keys[streamID].publicKey = publicKey;
			session.keys[streamID].privateKey = null;
		}).catch(function(err){
			errorlog(err);
		});

	};
	
	session.requestRateLimit = function(bandwidth, UUID){
		log("request rate limit: "+bandwidth);
		
		if (session.rpcs[UUID].manualBandwidth!==false){ // override the bandwidth; false is off
			if (session.rpcs[UUID].manualBandwidth == bandwidth){return;}
			session.rpcs[UUID].targetBandwidth=session.rpcs[UUID].manualBandwidth;
		} else if (bandwidth==false){
			// Just retry setting it.
			if (session.rpcs[UUID].targetBandwidth==session.rpcs[UUID].bandwidth){
				return;
			}
		} else {
			session.rpcs[UUID].targetBandwidth=bandwidth;
		}

		bandwidth = parseInt(session.rpcs[UUID].targetBandwidth);
		if (session.rpcs[UUID].bandwidth==bandwidth){return;}
		
		var msg = {};
		msg.bitrate = bandwidth;
		log(msg);
		
		if (session.sendRequest(msg,UUID)){
			session.rpcs[UUID].bandwidth=bandwidth;
		} else {
			setTimeout(function setratelimitfunc(){session.requestRateLimit(false, UUID);},5000); // just try re-setting it if it didn't work
			errorlog("couldn't set rate limit");
		}
	};
	
	session.remoteControl = function(event){
		event.preventDefault();
		var scale = parseFloat(event.deltaY * -0.001);
		log(event.currentTarget);
		
		if ((event.ctrlKey)||(event.metaKey)){  // focus
			session.requestFocusChange(scale, event.currentTarget.dataset.UUID);
		} else { // zoom
			session.requestZoomChange(scale, event.currentTarget.dataset.UUID);
		}
	};
	
	session.requestZoomChange = function(zoom, UUID, passwd = session.remote){
		log("request zoom change: "+zoom);
		log(UUID);
		var msg = {};
		msg.zoom = zoom;
		msg.remote = passwd;
		
		if (session.sendRequest(msg,UUID)){
			log('zoom success');
		} else {
			errorlog("failed to send zoom change request");
		}
	};
	
	session.requestFocusChange = function(focal, UUID, passwd = session.remote){
		log("request focus change: "+focal);
		
		var msg = {};
		msg.focus = focal;
		msg.remote = passwd;
		
		if (session.sendRequest(msg,UUID)){
			log('focus success');
		} else {
			errorlog("failed to send focus change request");
		}
	};
	
	session.limitBitrate = function(UUID, bandwidth){ 
		// In Chrome, use RTCRtpSender.setParameters to change bandwidth without
		// (local) renegotiation. Note that this will be within the envelope of
		// the initial maximum bandwidth negotiated via SDP.
		bandwidth = parseInt(bandwidth);
		try{
			if ((adapter.browserDetails.browser === 'chrome' ||
				adapter.browserDetails.browser === 'safari' ||
				(adapter.browserDetails.browser === 'firefox' &&
				adapter.browserDetails.version >= 64)) && 'RTCRtpSender' in window && 'setParameters' in window.RTCRtpSender.prototype){
					
					var sender = session.pcs[UUID].getSenders().find(function(s) {return s.track.kind == "video";});
					
					if (!sender){
						errorlog("can't change bitrate; no video sender found");
						return;
					}
					
					var parameters = sender.getParameters();
					if (!parameters.encodings){
						parameters.encodings = [{}];
					}
					if (bandwidth < 0) { // if -1 , this implies unlock.
						delete parameters.encodings[0].maxBitrate;
					} else {
						parameters.encodings[0].maxBitrate = bandwidth * 1000;
					}
					sender.setParameters(parameters).then(() => {
						  log("bandwidth set!");
						  log(sender.getParameters());
					}).catch(e => errorlog(e));
					return;
					
			}
		} catch(e){errorlog(e);}
	};
	
	function changeAudioOutputDevice(ele) {
		if (session.sink){
			navigator.mediaDevices.getUserMedia({audio:true,video:false}).then(function (stream){
				if (typeof ele.sinkId !== 'undefined'){
					ele.setSinkId(session.sink).then(() => {
						log("New Output Device:"+session.sink);
					}).catch(error => {
						errorlog(error);
						alert("Failed to change audio output destination.");
						// audioOutputSelect.selectedIndex = 0; // Jump back to first output device in the list as it's the default.
					});
				} else {
					alert("Your browser does not support alternative audio sources.");
				}
				stream.getTracks().forEach(track => {
					track.stop();
				});
			}).catch(function canplayspecificaudio(){alert("Can't play out to specific audio device without mic permissions allowed");});
		}
	}
	
	
	function extractSdp(sdpLine, pattern) {
		var result = sdpLine.match(pattern);
		return (result && result.length == 2)? result[1]: null;
	}
	function unlockBitrate(sdp, kbps=10000, screenshare=false){
		kbps = parseInt(kbps);
		if (kbps<50){kbps=50;}
		var bandwidth = {
			screen: 300, // 300kbits minimum
			audio: 50, // 50kbits  minimum
			video: kbps // 256kbits (both min-max)
		};
		// https://cdn.webrtc-experiment.com/CodecsHandler.js	
	//	sdp = CodecsHandler.preferCodec(sdp, 'h264');
		sdp = CodecsHandler.setApplicationSpecificBandwidth(sdp, bandwidth, screenshare);
		sdp = CodecsHandler.setVideoBitrates(sdp, {
			min: bandwidth.video,
			max: bandwidth.video
		});
		return sdp;
	}

	session.signData = function(data,callback){ // data as string
		log(data);
		if (session.mykey === {}){
			log("Generate Some Crypto keys first");
		}
		window.crypto.subtle.sign(
			{
				name: "RSASSA-PKCS1-v1_5",
			},
			session.mykey.privateKey, //from generateKey or importKey above
			session.enc.encode(data) //ArrayBuffer of data you want to sign
		).then(function(signature){
			//returns an ArrayBuffer containing the signature
			signature = new Uint8Array(signature);
			signature = signature.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
			//signature = new Uint8Array(signature.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
			//log(signature);
			callback(data,signature);
			log(JSON.stringify(signature));
		}).catch(function(err){
			errorlog(err);
		});
	};

	session.verifyData = function(data,streamID){
		data.signature = new Uint8Array(data.signature.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
		if (session.keys[streamID].publicKey){
			return window.crypto.subtle.verify({
				name: "RSASSA-PKCS1-v1_5",
			},
				session.keys[streamID].publicKey, //from generateKey or importKey above
				data.signature, //ArrayBuffer of the signature
				session.enc.encode(data.data) //ArrayBuffer of the data
			).then(function(isvalid){
				//returns a boolean on whether the signature is true or not
				log(isvalid);
				return isvalid;
			}).catch(function(err){
				errorlog(err);
				return false;
				//alert("Could not validate inbound connection");
			});
		}
	};

	session.changeTitle = function sessionchangetitle(title){
		var data = {};
		data.request = "changeTitle";
		data.title = title;
		session.sendMsg(data);
	};


	session.watchStream = function sessionwatchstream(streamID){
		//session.streamID = streamID; //  we won't remember what we asked for, but this keeps it simple 
		var data = {};
		data.request = "play";
		data.streamID = streamID;
		session.sendMsg(data);
	};

	session.debug = function sessiondebug(){
		var data = {};
		data.request = "debug123";
		session.sendMsg(data);
	};

	session.joinRoom = function sessionjoinroom(roomid,maxbitrate){
		var data = {};
		data.request = "joinroom";
		data.roomid = roomid;
		session.sendMsg(data);
		if (session.bitrate==false){
			session.bitrate = maxbitrate; // allow users to override, but otherwise limit it
		}
		session.listPromise = defer();
		return session.listPromise;
	};

	session.retryTimer = null; 
	session.ws=null;

	session.connect = function sessionconnect(reconnect=false){
		if (session.ws != null){return;}
		session.ws = new WebSocket("wss://api.obs.ninja:7443");

		session.sendMsg = function sessionsendmsg(msg){
			log("sending message");
			if (session.ws.readyState !== 1){session.msg = msg;} // store the last message to be sent if websocket is not ready. 
			else {
        session.msg=null;
        session.ws.send(JSON.stringify(msg));
      }
		};

		session.ws.onopen = function sessionwsopen(){
			if (session.retryTimer!=null){
				clearInterval(session.retryTimer);
				session.retryTimer=null;
			}

			log("connected to video server");
			if (session.msg!==null){  // send the last store message that was in queue to be sent when ws was closed.  sending 1 message is better than none, and I don't want to spam the server with hundreds. so this is a balance.
				session.ws.send(JSON.stringify(session.msg));
				session.msg = null;
			}
			if (reconnect==true){
				if (session.streamID){
					var data = {};
					data.request = "seed";
					//data.title = title;
					data.streamID = session.streamID;
					session.sendMsg(data);
				}
			}
		};

		session.ws.onmessage = function (evt) {
			var msg = JSON.parse(evt.data);
			if (msg.request){ // ACTIONS THAT ARE OUTSIDE THE SCOPE OF BASIC WEBRTC
				if (msg.request=="offerSDP"){  // newly connected client is asking for your SDP offer
					
					if (session.security){
						if (Object.keys(session.pcs).length>0){
							
							//var r = confirm("Press a button!");
							//if (r == true) {
							//  txt = "You pressed OK!";
							//} else {
							//  txt = "You pressed Cancel!";
							//} 
							setTimeout(function securitymodenabled() {alert("Security mode is enabled, yet a second connection request was recieved. It may be valid, but we will deny it out of extreme caution."); }, 1);
							return;
						}
						
					}
				
					session.offerSDP(session.streamSrc, msg.UUID);
				} else if (msg.request=="listing"){ // Get a list of streams you have access to
					log(msg.list);
					session.listPromise.resolve(msg.list); // used for rooms
				} else if (msg.request=="genkey"){ // prevents spoofing ; more for future work 
					session.generateCrypto();
				} else if (msg.request=="publickey"){ // prevents spoofing
					session.importCrypto(msg.key, msg.streamID);
				} else if (msg.request=="sendroom"){ // send a message to those in the group via server. p2p is probably the preferred method, but not always possible
					log("Inbound User-based Message from Room");
					// moved all this to WebRTC
					log(msg);
				} else if (msg.request=="someonejoined"){ // someone joined the room.  they may not have a video submitted: like the director.
					log("Someone Joined the Room");
					log(msg);
				} else if (msg.request=="videoaddedtoroom"){ // a video was added to the room
					log("Someone published a video to the Room");
					log(msg);
					if (session.view){
						var streamlist = session.view.split(",");
						for (var j in streamlist){
							if (msg.streamID === streamlist[j]){
								session.watchStream(msg.streamID);
							}
						}
					} else {
						session.watchStream(msg.streamID);
					}
				} else {
					log(msg);
				}


			} else if (msg.description){  // we don't get the STREAM ID back with this. That could be good from a privacy point of view -- no one in the group call will have Stream ID access for publishing?
				// For the sake of ease, I may just return the StreamID and revisit
				//log(msg.description);
				// var ttt=true;
				//if (msg.UUID in session.pcs)(ttt=false);
				if (msg.description.type=="offer"){
					session.setupIncoming(msg); // could end up setting up the peer the wrong way.
					session.connectPeer(msg);
				} else {
					session.pcs[msg.UUID].setRemoteDescription(msg.description).then().catch(onError);
				}
			} else if (msg.candidate){
				log("GOT ICE!!");
				if ((msg.UUID in session.pcs) && (msg.type=="remote")){
					log("PCS WINS ICE");
					session.pcs[msg.UUID].addIceCandidate(msg.candidate).then().catch(function(e){
						//console.error("ICE ERROR");
						errorlog(e);
						errorlog(msg);
					}); // NOT SURE ABOUT THIS
				} else if ((msg.UUID in session.rpcs ) && (msg.type=="local")) {
					log("RPCS WINS ICE");
					session.rpcs[msg.UUID].addIceCandidate(msg.candidate).then().catch(function(e){
						//console.error("ICE ERROR");
						errorlog(e);
						errorlog(msg);
					}); // NOT SURE ABOUT THIS
				} else {
					errorlog("ICE DID NOT FIND A PC OPTION?");
				}
			} else if (msg.request == "cleanup"){  // If someone disconnects from Websockets, and doesn't reconnect, THEN we can discard their key or something?
				log("Clean up");
				if (msg.UUID in session.pcs){
					log("problem");
					session.pcs[msg.UUID].close();
					delete(session.pcs[msg.UUID]);
					// I'll have to figure out where to reconnect somewhere else
				}
				if (msg.UUID in session.rpcs){
					log("problem");
					session.rpcs[msg.UUID].close();
					delete(session.rpcs[msg.UUID]);
					// I'll have to figure out where to reconnect somewhere else
				}

			} else { log("what is this?",msg); }
		};
		session.ws.onclose = function sessionwsclose(){
			errorlog("Connection to Control Server lost.\n\nAuto-reconnect is partially implemented");
			//session.retryTimer = setTimeout(function() {
			//	if (session.ws.readyState === WebSocket.CLOSED){
			//		session.ws=null;
			//		session.connect(true);
			//	}
			//}, 5550);
				
		};
	};


	// WEBCAM
	session.publishStream = function(stream, title="Stream Sharing Session"){ //  stream is used to generated an SDP
		log("STREAM SETUP");

		stream.oninactive = function streamoninactive() {
			errorlog('Stream inactive');
		};
		if (stream.getVideoTracks().length==0){
			errorlog("NO VIDEO TRACK INCLUDED");
		}

		if (stream.getAudioTracks().length==0){
			errorlog("NO AUDIO TRACK INCLUDED");
		}

		session.streamSrc=stream;
		var v = document.createElement("video");

		var container = document.createElement("div");
		container.id = "container";
		container.className = "vidcon";
		document.getElementById("gridlayout").appendChild(container);
		container.appendChild(v);

		v.className = "tile";
		
		if (session.director){
		} else if (session.scene){
			session.videoElement = v;
			updateMixer();
		} else if (session.roomid){
			session.videoElement = v;
			updateMixer();
		} else {
			
			v.style.boxShadow= "rgb(255, 255, 255) 0px 0px 115px 1px";
			
			v.style.maxWidth = "800px";
			v.style.maxHeight = "800px";
			
			v.style.width = "100%";
			v.style.maxHeight = "100%";
			
			v.style.display = "block";
			v.style.margin = "auto auto";
			container.style.width="100%"; 
			container.style.height="100%";
			//container.style.display = "flex";
			v.style.position = "relative";
			v.style.transform = "translate(0, -50%)";
			v.style.top = "50%";
			container.style.alignItems = "center";
			container.backgroundColor = "#666";
			
			v.className = "";
			
			setTimeout(function settimeoutdragelement(){dragElement(v);},1000);

		}


		v.autoplay = true;
		v.controls = true;
		v.muted = true;
		v.setAttribute("playsinline","");
		v.id = "videosource"; // could be set to UUID in the future
		
		try {
		    v.srcObject = session.streamSrc;
		} catch (e){errorlog(e);}
		
		try{
			var m = document.getElementById("mainmenu");
			m.remove();
		} catch (e){}
		
		var data = {};
		data.request = "seed";
		data.title = title;
		document.getElementById("reshare").value = "https://"+location.host+location.pathname+"?view="+session.streamID;
		data.streamID = session.streamID;
		session.sendMsg(data);
	};


	session.publishScreen = function(constraints, title="Screen Sharing Session", audioList=[]){ // webcam stream is used to generated an SDP
		log("SCREEN SHARE SETUP");
		if (!navigator.mediaDevices.getDisplayMedia){
			alert("Sorry, your browser is not supported. Please use the desktop versions of Firefox or Chrome instead");
			return false;
		}
		var streams = [];
		for (var i=1; i<audioList.length;i++){
			if (audioList[i].selected){
				var constraint = {audio: {deviceId: {exact: audioList[i].value}}};
				navigator.mediaDevices.getUserMedia(constraint).then((stream)=>{
					streams.push(stream);
				}).catch(errorlog);
			}
		}
		
		console.log(streams);
		return navigator.mediaDevices.getDisplayMedia(constraints)
			.then(function (stream) {
				
				if (session.roomid){
					console.log("ROOMID EANBLKED");
					window.addEventListener("resize", updateMixer);
					joinRoom(session.roomid);
					document.getElementById("head3").className = 'advanced';
				} else {
					document.getElementById("head3").className = '';
				}
				updateURL("push="+session.streamID);
				
				
				session.screenshare = true;
	
	
				console.log("adding tracks");
				for (var i=0; i<streams.length;i++){
					streams[i].getAudioTracks().forEach((track)=>{
						stream.addTrack(track);
						console.log(track);
					});
				}
				streams = null;
				if (stream.getAudioTracks().length==0){
					alert("No Audio Source was detected.");
				}
				session.streamSrc=stream;
				var v = document.createElement("video");
				var container = document.createElement("div");
				container.id = "container";
				container.className = "vidcon";
				document.getElementById("gridlayout").appendChild(container);
				container.appendChild(v);
				

				v.className = "tile";
				
				if (session.director){
				} else if (session.scene){
					session.videoElement = v;
					updateMixer();
				} else if (session.roomid){
					session.videoElement = v;
					updateMixer();
				} else {
					v.style.boxShadow= "rgb(255, 255, 255) 0px 0px 115px 1px";
					
					v.style.maxWidth = "800px";
					v.style.maxHeight = "800px";
					
					v.style.width = "100%";
					v.style.maxHeight = "100%";
					
					v.style.display = "block";
					v.style.margin = "auto auto";
					container.style.width="100%"; 
					container.style.height="100%";
					container.style.display = "flex";
					container.style.alignItems = "center";
					container.backgroundColor = "#666";
					
					v.className = "";
				}

				v.autoplay = true;
				v.controls = true;
				v.setAttribute("playsinline","");
				v.muted = true;
				v.id = "videosource"; // could be set to UUID in the futur
				
				if (!v.srcObject || v.srcObject.id !== stream.id) {
					v.srcObject = stream;
				}
				try{
					var m = document.getElementById("mainmenu");
					m.remove();
				} catch (e){}

				//	stream.getTracks().forEach(track => track.play());

				var data = {};
				data.request = "seed";
				document.getElementById("reshare").value = "https://"+location.host+location.pathname+"?view="+session.streamID;
				data.streamID = session.streamID;
				data.title = title;
				session.sendMsg(data);
				return true;
				
				
			}).catch(function(error){
				log('getDisplayMedia error: ' + error.name, error);
				errorlog(error);
				return false;
				//alert("You have denied the website access to screen-share. You will need to refresh to try again.");
				
			});
	};

	session.publishFile = function(ele,event, title="Video File Sharing Session"){ // webcam stream is used to generated an SDP
		log("FILE SHARE SETUP");

		var file = ele.files[0];
		var type = file.type;

		var fileURL = URL.createObjectURL(file);

		var container = document.createElement("div");
		container.id = "container";
		container.className = "vidcon";
		var v = document.createElement("video");
		document.getElementById("gridlayout").appendChild(container);
		container.appendChild(v);
		v.autoplay = false;
		v.controls = true;
		v.muted = false;
		v.loop = true;
		v.setAttribute("playsinline","");
		v.src = fileURL;

		if (session.director){
		} else if (session.scene){
			session.videoElement = v;
			updateMixer();
		} else if (session.roomid){
			session.videoElement = v;
			updateMixer();
		}


		var canPlay = v.canPlayType(type);
		if (canPlay === ''){canPlay = 'no';}
		log('Can play type "' + type + '": ' + canPlay);
		if (canPlay === 'no') {
			v.outerHTML = "";
			alert("Cannot play this file type. Please refresh and try another option ");
			return;
		}

		v.id = "videosource"; // could be set to UUID in the future
		v.className = "tile";
		var m = document.getElementById("mainmenu");
		m.remove();

		try{
			session.streamSrc=v.captureStream();
		} catch(e){
			log(e);
			alert("Safari and many older browsers do not support this feature. Perhaps try using Chrome or Firefox on desktop instead. Please refresh to try another option.");
			v.outerHTML = "";
			return false;
		}


		var data = {};
		data.request = "seed";
		data.title = title;
		document.getElementById("reshare").value = "https://obs.ninja/?view="+session.streamID;
		data.streamID = session.streamID;
		session.sendMsg(data);
	};

	session.sendMessage = function(msg, UUID=null){ // Publisher signs the request. This lets sub-viewers, if any, verify if a message is from the original publisher or not.
		msg.timestamp = Date.now().toString();
		msg.counter = session.counter;

		session.signData(msg,function(data,signature){
			session.counter += 1;

			if (UUID == null){ // send to all RTC peers i'm publishing to
				for (var i in session.pcs){
					try{
						session.pcs[i].sendChannel.send(JSON.stringify({data,signature}));
					} catch(e){
						log("RTC Connection seems to be dead? is it? If it is, or can't be validated, close this shit");
						//session.pcs[i].close();
						//delete(session.pcs[i]);
					}
				}
			} else {
				try{
					session.pcs[UUID].sendChannel.send(JSON.stringify({data,signature}));
				} catch(e){
					log("RTC Connection seems to be dead? is it? If it is, or can't be validated, close this shit");
					//session.pcs[UUID].close();
					//delete(session.pcs[UUID]);
				}	
			}
		});
	};
	
	session.sendRequest = function(msg, UUID){ // Publisher signs the request. This lets sub-viewers, if any, verify if a message is from the original publisher or not.
		try{
			msg.timestamp = Date.now().toString();
			session.rpcs[UUID].receiveChannel.send(JSON.stringify(msg));
			return true;
		} catch(e){
			log("PUBLISHER's RTC Connection seems to be dead? ");
			return false;
		}	
	};

	if (window.obsstudio){
		window.obsstudio.onVisibilityChange = function obsvisibility(visibility){
			try {
				log("OBS VISIBILITY:"+visibility);
				if (session.disableOBS===false){	
					for (var UUID in session.rpcs){
						if (session.rpcs[UUID].visibility!==visibility){ // only move forward if there is a change; the event likes to double fire you see.
							
							session.rpcs[UUID].visibility = visibility;
							
							var bandwidth = parseInt(session.rpcs[UUID].targetBandwidth);  // we don't want to change the target bandwidth, as that's still the real goal and are point of reference for reverting this change.
							log("bandwidth:"+bandwidth);
							if (visibility==false){ // limit bandwidth if not visible
								if ((bandwidth>100) || (bandwidth<0)){ // only set it to 50kbps if not already lower for some reason.
									bandwidth = 100;
								}
							}
							
							var msg = {};
							msg.visibility = visibility;
							
							if (session.rpcs[UUID].bandwidth !== bandwidth){ // bandwidth already set correctly. don't resent.
								msg.bitrate = bandwidth;
								if (session.sendRequest(msg, UUID)){
									session.rpcs[UUID].bandwidth=bandwidth; // this is letting the system know what the actual bandwidth is, even if it isn't the real target.
								}
							} else {
								session.sendRequest(msg, UUID); // no need to check
							}
						}
					}
				}
			} catch (e){errorlog(e)};
		};
	}


	session.remoteZoom = function(zoom){
		try {
			var track0 = session.streamSrc.getVideoTracks();
			track0 = track0[0];
			var capabilities = track0.getCapabilities();
			//var settings = track0.getSettings();
			
			if (session.zoom==false){
				session.zoom = capabilities.zoom.min;
			}
			
			session.zoom+=zoom;
			if (session.zoom>capabilities.zoom.max){
				session.zoom = capabilities.zoom.max;
			} else if (session.zoom<capabilities.zoom.min){
				session.zoom = capabilities.zoom.min;
			}
			
			track0.applyConstraints({advanced: [ {zoom: session.zoom} ]});
		} catch(e){
			errorlog(e);
		}
	};
	
	
	session.remoteFocus = function(focusDistance){
		try {
			var track0 = session.streamSrc.getVideoTracks();
			track0 = track0[0];
			var capabilities = track0.getCapabilities();
			//var settings = track0.getSettings();
			
			if (session.focusDistance==false){
				session.focusDistance = capabilities.focusDistance.min;
			}
			
			session.focusDistance+=focusDistance;
			if (session.focusDistance>capabilities.focusDistance.max){
				session.focusDistance = capabilities.focusDistance.max;
			} else if (session.focusDistance<capabilities.focusDistance.min){
				session.focusDistance = capabilities.focusDistance.min;
			}
			
			track0.applyConstraints({advanced: [ {focusMode: "manual", focusDistance: session.focusDistance} ]});
		} catch(e){
			errorlog(e);
		}
	};
	
	
	session.offerSDP = function(stream,UUID){  // publisher/offerer (PCS)
		if (UUID in session.pcs){
				errorlog("PROBLEM! RESENDING SDP OFFER SHOULD NOT HAPPEN");
				session.createOffer(session.pcs[UUID], UUID);
				return;
		}
		else {log("Create a new RTC connection; offering SDP on request");}

		session.pcs[UUID] = new RTCPeerConnection(session.configuration);
		session.pcs[UUID].UUID = UUID;
		session.pcs[UUID].sendChannel = session.pcs[UUID].createDataChannel("sendChannel");

		//session.pcs[UUID].sendChannel.onopen = () => { // we don't need this anymore if muting locally.
		//	var msg = {};
		//	msg["volume"] = session.volume;
		//	session.sendMessage(msg, UUID); //TODO: does this work? UUID being passed like this?
		//};

        session.pcs[UUID].sendChannel.onclose = () => {
			log("send channel closed");
         };

		session.pcs[UUID].sendChannel.onmessage = (e)=>{  // the publisher is getting a message from its viewer.  Things like, please zoom in.
			log("recieved data from viewer");
			var msg = JSON.parse(e.data);
			log(msg);
			if ("bitrate" in msg){
				session.limitBitrate(UUID, msg.bitrate);
			}
			if ("zoom" in msg){  
				if (session.remote){  // can only ask to zoom in if passwords match
					if ("remote" in msg){
						if (msg.remote === session.remote){ // authorized
							session.remoteZoom(parseFloat(msg.zoom));
						}
					} else { // no password provided by remote
						return;
					}
				}
			}
			if ("focus" in msg){
				if (session.remote){
					if ("remote" in msg){
						if (msg.remote === session.remote){ // authorized
							session.remoteFocus(parseFloat(msg.focus));
						}
					} else { // no password provided by remote
						return;
					}
				}
			}
			if ("visibility" in msg){  // This can be spoofed by anyone, but it's harmless. won't bother to password protect
				if (msg.visibility==true){
					if (document.getElementById("videosource")){
						document.getElementById("videosource").style.boxShadow = "rgb(255, 200, 200) 0px 0px 135px 1px";
					}
				} else {
					if (document.getElementById("videosource")){
						document.getElementById("videosource").style.boxShadow = "rgb(128, 150, 135) 0px 0px 60px 1px";
					}
				}
			}
			
			if (("audio" in msg) || ("video" in msg)){ // this adds audio/video for just the person sending the message; so it's safe to allow. (iOS publishers need to check to make sure tho)
				stream.getTracks().forEach(track => {
					if ("audio" in msg){
						if (msg.audio==true){
							if (track.kind=="audio"){
								session.pcs[UUID].addTrack(track, stream);
							}
						}
					}
					if ("video" in msg){
						if (msg.video==true){
							if (track.kind=="video"){
								session.pcs[UUID].addTrack(track, stream);
							}
						}
					}
				});
			}
			/// validate who is the DIRECTOR ; use the UUID and signing
			try {
				if ("director" in msg){  //  This is the director-related feed
					if (msg.director === session.scene){
						if ("action" in msg){
							if ("target" in msg){
								for (var i in session.rpcs){ // If you are VIEWING this use
									if (i === msg.target){
										if ("value" in msg){
											if (msg.action == "mute"){	
												if (msg.value == 0){
													log("Mute video -306");
													
													if (session.rpcs[i].videoElement){
														session.rpcs[i].videoElement.muted = true;
														session.rpcs[i].director = 0;
													}
												} else {
													log("Unmute video");
													if (session.rpcs[i].videoElement){
														session.rpcs[i].director = 1;
														if (session.rpcs[i].publisher!==false){
															if (session.rpcs[i].publisher == 0){
																log("did not mute");
																return;} // if the publisher wants it muted. it says muted
														}
														session.rpcs[i].videoElement.muted = false;
													}
												}
											}  else if (msg.action == "display"){
												if (msg.value == 0) { 
													if (session.rpcs[i].videoElement){
														session.rpcs[i].videoElement.style.display="none";
														///  I can probably just go thru the RPCS[] list, using UUID, and say "visible" or not. Use Update on that instead.
														// I won't need to update the lement directly , just the update function.
													}
													updateMixer();
												} else { 
													if (session.rpcs[i].videoElement){
														session.rpcs[i].videoElement.style.display="block";
													
														if (session.rpcs[i].videoElement===false){
															session.rpcs[i].director = 1;
														}
														if (session.rpcs[i].director){
															if (session.rpcs[i].publisher!==false){
																if (session.rpcs[i].publisher == 0){return;}
																	
																session.rpcs[i].videoElement.muted=false;
																log("UN-MUTED");
															

															}	
														}
													}
													updateMixer();
												}
											} else if (msg.action == "volume"){
												log(parseInt(msg.value)/100.0);
												if (session.rpcs[i].videoElement){
													session.rpcs[i].videoElement.volume=parseInt(msg.value)/100.0;
													log("UN-MUTED");
												}
											}
										}
									}
								}

							}
						}
					}
				}
			} catch(e){
				 errorlog(e);
			}
		}

		//log("pubs streams to offeR",stream.getTracks());	
		//stream.getTracks().forEach(track => {
		//	var sender = session.pcs[UUID].addTrack(track, stream);
		//});
		
		session.pcs[UUID].ontrack = event => {errorlog("Publisher is being sent a video stream??? NOT EXPECTED!");};

		session.pcs[UUID].onicecandidate = function(event){
			log("CREATE ICE 3");
			if (event.candidate==null){log("empty ice..");return;}
			var data = {};
			data.UUID = UUID;
			data.type = "local";
			data.candidate = event.candidate;
			log("UUID==="+UUID);
			session.sendMsg(data);
		};

		session.pcs[UUID].oniceconnectionstatechange = function sessiononconnectionstatechange(){
			try {
				if (this.iceConnectionState == 'closed') {
					log('ICE closed?');
                 } else	if (this.iceConnectionState == 'disconnected') {
					log('ICE Disconnected; wait for retry? pcs');
					session.pcs[UUID].close();
					session.pcs[UUID] = null;
					if (session.security){
						setTimeout(function settimeoutpeerdisconnected() {alert("Remote peer disconnected. Due to enhanced security, please refresh to create a new connection.");}, 1);
					}
					delete(session.pcs[UUID]);
				} else if (this.iceConnectionState == 'failed') {
					log('ICE FAILed. bad?');
					
				} else if (this.iceCOnnectionState == "connected"){
					
					if (session.security){
							session.ws.close();
							setTimeout(function setitimeoutkilled() {alert("Remote peer connected to video stream.\n\nConnection to server being killed on request. This increases security, but the peer will not be able to reconnect automatically on connection failure.");}, 1);
					}
				} else {
					log(this.iceConnectionState);
				}
			} catch(e){
				errorlog(e);
			}
		};
		
		session.pcs[UUID].onconnectionstatechange = function sessiononconnecstatechange(){
			switch (session.pcs[UUID].connectionState){
				case "connected":
					if (session.security){
						session.ws.close();
						alert("Remote peer connected to video stream.\n\nConnection to server being killed on request. This increases security, but the peer will not be able to reconnect automatically on connection failure.");
					}
          break;
				case "disconnected":
					break;
				case "failed":
					// One or more transports has terminated unexpectedly or in an error
					break;
				case "closed":
					// The connection has been closed
					break;
			}
		};
		
		session.createOffer = function(pc, UUID){
			pc.createOffer().then((description)=>{
				if (session.stereo){
					//description.sdp = CodecsHandler.forceStereoAudio(description.sdp);
					description.sdp = CodecsHandler.setOpusAttributes(description.sdp, {  // lets give the 
						'stereo': 1,
						'sprop-stereo': 1,
						//'maxaveragebitrate': 128 * 1000 * 8,
						//'maxplaybackrate': 128 * 1000 * 8,
						//'cbr': 1,
						//'useinbandfec': 1,
						// 'usedtx': 1,
						'maxptime': 3
					});
					log("stereo enabled");
				}
				
				//if (session.bitrate){
				//	log("bit rate being munged");
				//	description.sdp = unlockBitrate(description.sdp, session.bitrate, session.screenshare);
				//} else 
				//if (session.codec){
					
				//	description.sdp = CodecsHandler.preferCodec(description.sdp, session.codec); // h264, vp8, vp9
				//}
				
				
				pc.setLocalDescription(description).then(function setlocalpdescription(){
					log("publishing SDP Offer");
					var data = {};
					data.description = pc.localDescription;
					data.UUID = UUID;
					data.streamID = session.streamID;
					session.ws.send(JSON.stringify(data));
				}).catch(onError);
			}).catch(onError);
		};
		
		session.pcs[UUID].onnegotiationneeded = function onnegtitatedneeded(){ // bug: https://groups.google.com/forum/#!topic/discuss-webrtc/3-TmyjQ2SeE
			session.createOffer(session.pcs[UUID], UUID);
		};

		//session.pcs[UUID].sendChannel = session.pcs[UUID].createDataChannel("sendChannel");
		session.pcs[UUID].onclose = function sessiononclosemsg(){
			log("WebRTC Connection Closed. Clean up. 657");
			session.pcs[UUID].
			session.pcs[UUID] = null;
			delete(session.pcs[UUID]);
		};
		session.pcs[UUID].onopen = function sessiononopensession(){
			log("WEBRTC CONNECTION OPEN");

		};

	};

	session.connectPeer = function(msg){ // someone is SENDING us a video stream
		session.rpcs[msg.UUID].setRemoteDescription(msg.description).then(function seremotedescriptthen(){  // description, onSuccess, onError
			if (session.rpcs[msg.UUID].remoteDescription.type === 'offer'){ // When receiving an offer/video lets answer it
				session.rpcs[msg.UUID].createAnswer().then(function(description){  // creating answer
					if (session.stereo){
    					description.sdp = CodecsHandler.setOpusAttributes(description.sdp, {
							'stereo': 1,
							'sprop-stereo': 1,
							'maxaveragebitrate': 128 * 1000 * 2,
							'maxplaybackrate': 128 * 1000 * 2,
							//'cbr': 1,
							//'useinbandfec': 1,
							// 'usedtx': 1,
							'maxptime': 3
						});
					}
					
					
					if (session.bitrate){  // works with vp8, not vp9
						log("bit rate being munged");
						description.sdp = unlockBitrate(description.sdp, session.bitrate); // vp8?  VP9 doesn't seem to support dynamic bitrates.
					} else if (session.codec){
						description.sdp = CodecsHandler.preferCodec(description.sdp, session.codec); // default 
					}
					return session.rpcs[msg.UUID].setLocalDescription(description);
				}).then(function providededanswer(){
					log("providing answer");
					var data = {};
					data.UUID = msg.UUID;
					data.description = session.rpcs[msg.UUID].localDescription; // send our updated self identify
					session.sendMsg(data);

					data = {};
					data.request = "getkey";
					//data.UUID = msg.UUID;   -- they other party does not need this
					data.streamID = session.rpcs[msg.UUID].streamID;
					session.sendMsg(data);

				}).catch(onError);
			} else if (session.rpcs[msg.UUID].remoteDescription.type === 'answer'){  // someone responded to one of our answers; they presumably requested an offerSDP
			}
		}).catch(onError);
	};
	/// THE PROBLEM IS I HAVE A PATH WAY FOR INPUT AND A PATHWAY FOR OUTPUT, BU THEY SHARE THE SAME PATHWAY. LOL.  I NEED TO COMBINE THESE INTO ONE.
	session.setupIncoming = function(msg){ // ingesting stream as a viewer
		var UUID = msg.UUID;
		if (UUID in session.rpcs){log("RTC connection is ALREADY ready; we can already accept answers");return;} // already exists
		else {log("MAKING A NEW RTC CONNECTION");}
		session.rpcs[UUID] = new RTCPeerConnection(session.configuration);
		session.rpcs[UUID].bandwidth=-1;
		session.rpcs[UUID].targetBandwidth=-1;
		session.rpcs[UUID].manualBandwidth=false;
		session.rpcs[UUID].videoElement=false;
		session.rpcs[UUID].director=false;
		session.rpcs[UUID].publisher=false;
		session.rpcs[UUID].stats = false;
		session.rpcs[UUID].visibility = true; // assume by default OBS has the scene visible
		//session.rpcs[UUID].volume=1;
		//session.rpcs[UUID].muted=false;
		
		session.rpcs[UUID].UUID = UUID;
		if ("streamID" in msg){
			session.rpcs[UUID].streamID = msg.streamID;
		}
		//session.rpcs[UUID].addTransceiver('video', { direction: 'recvonly'});  // this breaks OBS v23
		session.rpcs[UUID].onclose = function(event){
			log("rpc closed");
			try {
				var streamID = this.streamID; // reconnect if possible
				var data = {};
				data.request = "play";
				data.streamID = streamID;
				session.sendMsg(data);
			} catch(e){
				errorlog("Couldn't re-connect"); // Might be fone forever. :(  Set a timeout? TODO
				errorlog(e);
			}
			
			if (!(session.director)){
				if ((session.scene) || (session.roomid)){
					try {
						if (session.rpcs[UUID].videoElement){
							session.rpcs[UUID].videoElement.style.display = "none";
						} 
						updateMixer();
					} catch (e){ }
				}
			}
			
			try {	
				if (document.getElementById("container_"+UUID)){
					document.getElementById("container_"+UUID).parentNode.removeChild(document.getElementById("container_"+UUID));
				}
			} catch (e){errorlog(e);}
			
			try {	
				if (this.streamSrc){
					this.streamSrc.getTracks().forEach(function(track) {
						   track.stop();
					});
				}
                } catch (e){errorlog(e);}
			try {
				this.receiveChannel.close();
			}catch (e){errorlog(e);}	
			
			try {
				session.rpcs[this.UUID] = null;
				delete(session.rpcs[this.UUID]);
			} catch (e){errorlog(e);}

		};

		session.rpcs[UUID].onicecandidate = function(event){
			log("CREATE ICE RCPS");
			if (event.candidate==null){log("null ice rpcs");return;}
			var data = {};
			log("UUID ICE:"+UUID);
			data.UUID = UUID;
			data.type = "remote";
			data.candidate = event.candidate;
			session.sendMsg(data);
		};

		session.rpcs[UUID].onconnectionstatechange = function(event){
			switch (event.srcElement.connectionState) {
				case "connected":
					if (event.srcElement.videoElement){
                        event.srcElement.videoElement.srcObject = event.srcElement.streamSrc;
					}
					log("** connected");
					// The connection has become fully connected
					break;
				case "disconnected":
					log(" ** disconnected");
          break;
				case "failed":
					// One or more transports has terminated unexpectedly or in an error
					break;
				case "closed":
					// The connection has been closed
					break;
			}	
		};

		session.rpcs[UUID].oniceconnectionstatechange = function oncicestaegchanrpcs() {
			try{

				if (this.iceConnectionState == 'closed') {
					errorlog('CLOSED');
				} else  if (this.iceConnectionState == 'disconnected') {
					errorlog('ICE Disconnected; wait for retry? rpcs');
					log(this.streamID);
					var sid = this.streamID;
					try {
						setTimeout(()=>{log("TRYING TO RECONNECT");session.watchStream(sid);},3000);
					} catch (e){
						errorlog(e);
					}
					if (this.streamSrc){
						this.streamSrc.getTracks().forEach(function(track) {
							track.stop();
							log("Track stopped");
						});
					}
					if (!(session.director)){
						if ((session.scene) || (session.roomid)){
							try {
								if (session.rpcs[UUID].videoElement){
									session.rpcs[UUID].videoElement.style.display = "none";
									updateMixer();
								}
							} catch (e){ }
						}
					} else {
						try{
							if ("recoder" in session.rpcs[UUID].videoElement){
								session.rpcs[UUID].videoElement.recorder.stop();
							}
						} catch (e){
							errorlog(e);
						}
					}
					try {
						if (document.getElementById("container_"+this.UUID)){
							document.getElementById("container_"+this.UUID).parentNode.removeChild(document.getElementById("container_"+this.UUID));
						}
					} catch (e){}
					session.rpcs[this.UUID].close();
					session.rpcs[this.UUID] = null;
					delete(session.rpcs[this.UUID]);

				} else if (this.iceConnectionState == 'failed') {
					errorlog("ICE FAILED");
				} else {
					log("ICE: "+this.iceConnectionState);
				}

			} catch (E){}
		};

		session.rpcs[UUID].ondatachannel = (event)=>{ // recieve data from peer; event data maybe


			session.rpcs[UUID].receiveChannel = event.channel;
			
			var msg = {}; // Request video/audio
			msg.audio = session.audio;
			msg.video = session.video;
			session.sendRequest(msg, UUID);  // send via WebRTC
			
			session.rpcs[UUID].receiveChannel.onmessage = (e)=>{ // the publisher is telling the viewer to do something; like mute their mic
				log("recieved data: "+e.data);
				var msg = JSON.parse(e.data);
				log(msg);
				//if (session.verifyData(msg,session.rpcs[UUID]['streamID'])){  // I'm just going to disable security for now.
				if ("data" in msg){
					if ("volume" in msg.data){ // mute or change volume
						log("Changing volume");
						log(parseInt(msg.data.volume)/100.0);
						var volume = parseInt(msg.data.volume)/100.0; //
						session.rpcs[UUID].publisher = parseInt(msg.data.volume);
						if (session.scene){
							if (session.rpcs[UUID].director !== false){
								if (session.rpcs[UUID].director==0){
									log("Mute override by director; this is a scene");
									return;
								} 	
							} else {
								session.rpcs[UUID].videoElement.muted = true;
								session.rpcs[UUID].videoElement.volume = 1;
								log("Mute override by director; this is a scene and the director has not unmuted");
								return;
							}
						}
						if (!session.director){ // we shouldn't be muting or such unless its the director
							if (session.rpcs[UUID].videoElement.volume==0){
								if (volume>0){
									session.rpcs[UUID].videoElement.muted=false; // TODO: THIS SHOULDn't be UUID? or should it be STREAMID? *fak*
									session.rpcs[UUID].videoElement.volume = volume;
								} else {
									session.rpcs[UUID].videoElement.muted=true;
								}
							} else if (volume>0){
								session.rpcs[UUID].videoElement.muted=false;
								log("unmuted 900");
							} else {
								session.rpcs[UUID].videoElement.muted=true;
							}
						}
					}}
				//}

			};
			
			//session.rpcs[UUID].receiveChannel.onopen = function(){log("data channel opened");};

			session.rpcs[UUID].receiveChannel.onclose = () => {
				log("rpc datachannel closed");
				//this.receiveChannel.close();
				//session.rpcs[UUID].close();
			};
		};

		session.playoutdelay = function(UUID){  // applies a delay to all videos
			var buffer = session.buffer || 0;
			buffer = parseFloat(buffer)/1000;
			log("playout delay: "+buffer);
			
			
			if (session.buffer!==false){
				log("start");
				var receivers = session.rpcs[UUID].getReceivers().reverse();
				var video_delay = 0;
				receivers.forEach(function(receiver){
					try {
							for (var tid in session.rpcs[UUID].stats){
								if ((session.rpcs[UUID].stats[tid].id) && (session.rpcs[UUID].stats[tid].id==receiver.track.id) && (session.rpcs[UUID].stats[tid].delay)){
									
									var buf = buffer;
									var sync_offset = 0.0;
									
									if (session.rpcs[UUID].stats[tid].sync_offset){
										sync_offset = session.rpcs[UUID].stats[tid].sync_offset;
									} else {
										session.rpcs[UUID].stats[tid].sync_offset = 0;
									}
									
									sync_offset+= buf - session.rpcs[UUID].stats[tid].delay;
									
									if (session.rpcs[UUID].stats[tid].type=="audio"){
										if (!(receiver.delayNode)){  // setup audio delay node; works to sync audio and video; does not delay video
											var audioCtx = new AudioContext();
											var source = audioCtx.createMediaStreamSource(new MediaStream([receiver.track]));
											receiver.delayNode = audioCtx.createDelay(5.0);
											var audio_delay = (video_delay - session.rpcs[UUID].stats[tid].delay); // video is typically showing greater delay than video
											if (audio_delay<0){audio_delay=0;}
											receiver.delayNode.delayTime.value = parseFloat(audio_delay);
											source.connect(receiver.delayNode);
											var dst = audioCtx.createMediaStreamDestination();
											receiver.delayNode.connect(dst);
											log("delaying audio by: "+audio_delay);
										} else {
											var audio_delay = (video_delay - session.rpcs[UUID].stats[tid].delay); // video is typically showing greater delay than video
											if (audio_delay<0){audio_delay=0;}  // Since playoutDelay may not be compatible, since its not with OBS v25, all we can do is delay audio; not delay video
											receiver.delayNode.delayTime.value = parseFloat(audio_delay); // apply delay delta (different between video and audio) ; it's not instant.
											log("delaying audio by: "+audio_delay);
										}
									} else {
										video_delay = session.rpcs[UUID].stats[tid].delay;
										if(sync_offset<0){sync_offset=0;}
										session.rpcs[UUID].stats[tid].sync_offset = sync_offset;
										receiver.playoutDelayHint = sync_offset;	  // only the video we are going to do the playout delay for; doesn't work well with audio.
									}
								}
							}
					} catch (e){errorlog(e);}
				});	
			}
		};

		session.processStats = function(UUID){
			try {
				session.rpcs[UUID].getStats().then(function(stats){
					setTimeout(session.processStats, 5000, UUID);
					console.log("STTTTTTTTATS");
					if (!session.rpcs[UUID].stats){
						
						session.rpcs[UUID].stats = {};
						
						stats.forEach(stat=>{
							if ((stat.type=="track") && (stat.remoteSource==true)){
								var media = {};
								media.jitter_delay = parseFloat(stat.jitterBufferDelay) || 0;
								media.jitter_count = parseInt(stat.jitterBufferEmittedCount) || 0;
								media.id = stat.trackIdentifier;
								media.delay = 0;
								media.type = stat.kind;
								session.rpcs[UUID].stats[stat.id] = media;
							} 
						});
						return;
					}
					
					stats.forEach(stat=>{
						if ((stat.type=="track") && (stat.remoteSource==true)){
							if (stat.id in session.rpcs[UUID].stats){
								
								log(stat);
								
								session.rpcs[UUID].stats[stat.id].delay = (parseFloat(stat.jitterBufferDelay) - session.rpcs[UUID].stats[stat.id].jitter_delay)/(parseInt(stat.jitterBufferEmittedCount) - session.rpcs[UUID].stats[stat.id].jitter_count) || 0;
								session.rpcs[UUID].stats[stat.id].jitter_delay = parseFloat(stat.jitterBufferDelay) || 0;
								session.rpcs[UUID].stats[stat.id].jitter_count = parseInt(stat.jitterBufferEmittedCount) || 0;
								if ("frameWidth" in stat){
									session.rpcs[UUID].stats[stat.id].width = stat.frameWidth;
								}
								if ("frameHeight" in stat){
									session.rpcs[UUID].stats[stat.id].height = stat.frameHeight;
								}
								//log(stat);
							} else {
								var media = {};
								media.jitter_delay = parseFloat(stat.jitterBufferDelay) || 0;
								media.jitter_count = parseInt(stat.jitterBufferEmittedCount) || 0;
								media.id = stat.trackIdentifier;
								media.delay = 0;
								media.type = stat.kind;
								session.rpcs[UUID].stats[stat.id] = media;
							}
						} else if (stat.type=="remote-candidate"){
							session.rpcs[UUID].stats.remote_peer = stat.candidateType;
							
						} else if (stat.type=="local-candidate"){
							session.rpcs[UUID].stats.local_peer = stat.candidateType;
							
						} else if ((stat.type=="inbound-rtp") && ("trackId" in stat)){
							session.rpcs[UUID].stats[stat.trackId] = session.rpcs[UUID].stats[stat.trackId] || {};
							session.rpcs[UUID].stats[stat.trackId].last_bytes = session.rpcs[UUID].stats[stat.trackId].last_bytes || stat.bytesReceived;
							session.rpcs[UUID].stats[stat.trackId].last_time = session.rpcs[UUID].stats[stat.trackId].last_time || stat.timestamp;
							session.rpcs[UUID].stats[stat.trackId].bitrate_kbps =  8*(stat.bytesReceived - session.rpcs[UUID].stats[stat.trackId].last_bytes)/( stat.timestamp - session.rpcs[UUID].stats[stat.trackId].last_time);
							session.rpcs[UUID].stats[stat.trackId].type = stat.mediaType;
						}
						
					});
					if (session.buffer!==false){
						session.playoutdelay(UUID);
					}
				});
			} catch (e){errorlog(e);}
		};

		session.printStats = function(uid,ele){
			//log();
			ele.innerHTML="";
			function printValues(obj) {
				for (var key in obj) {
					if (typeof obj[key] === "object") {
						ele.innerHTML +="<br />";
						printValues(obj[key]);   
					} else {
						ele.innerHTML +="<b>"+key+"</b>: "+obj[key]+"<br />";
					}
				}
			}
			printValues(session.rpcs[uid].stats);
		};

		session.rpcs[UUID].ontrack = event => {
			
			const stream = event.streams[0];
			
			session.rpcs[UUID].streamSrc = stream;
			session.playoutdelay(UUID);
			
			// for (rpc in session.rpcs){session.rpcs[rpc].getStats().then(function(stats) {stats.forEach(stat=>{if (stat.id.includes("RTCIce")){console.log(stat)}})})};

			if (session.rpcs[UUID].videoElement){
				var v = session.rpcs[UUID].videoElement;
				if (session.rpcs[UUID].connectionState ==  "connected"){
					v.srcObject = stream;
					
				} 
			} else {
				log("video element is being created and media track added");

				var container = document.createElement("div");	
				container.id = "container_"+UUID;
				container.className = "vidcon";
				var v = document.createElement("video");
				session.rpcs[UUID].videoElement = v;
				document.getElementById("gridlayout").appendChild(container);
				container.appendChild(v);
				log("!!");
				v.muted = false;
				v.volume = 1.0; // play audio automatically
				v.autoplay = true;
				v.controls = false;
				v.dataset.UUID = UUID; 
				v.id = "videosource_"+UUID; // could be set to UUID in the future
				v.className += "tile";
				v.setAttribute("playsinline","");
				
				changeAudioOutputDevice(v);  // if enabled, changes to desired output audio device.
				
				if (session.rpcs[UUID].connectionState ==  "connected"){
					v.srcObject = stream;
				} 
				if (document.getElementById("mainmenu")){
					var m = document.getElementById("mainmenu");
					m.remove();
				}

				if (session.director){
					
					if (document.getElementById("deleteme")){
						document.getElementById("deleteme").parentNode.removeChild(document.getElementById("deleteme"));
					}
					var controls = document.getElementById("controls_blank").cloneNode(true);
					controls.id = "controls_"+UUID;
					v.muted= true; // do not play audio automatically in director's room
					v.volume = 1.0;
					v.controls = true;
					container.style.margin="2px 0px 10px 10px";
					controls.dataset.UUID = UUID; 
					controls.style.display = "block";
					controls.innerHTML += "<div style='padding:5px;font-size:120%; word-wrap: break-word; '><i class='fa fa-user' aria-hidden='true'></i> <b>SOLO LINK for OBS:</b><input onmousedown='copyFunction(this)' onclick='popupMessage(event);copyFunction(this)' data-drag='1' style='cursor:grab;font-weight:bold;color:white;background-color:#080;width:380px;font-size:70%;padding:10px;border:2px solid black;margin:5px;' value='https://"+location.host+location.pathname+"?view="+session.rpcs[UUID].streamID+"&scene=1&room="+session.roomid+"' /></div>";
					container.appendChild(controls);
					
					session.requestRateLimit(100,UUID); /// limit resolution for director
					
				} else if (session.scene){
					
					if (session.view){
						v.style.display="block";
						
					} else {
						v.style.display="none";
					}
					updateMixer();
				} else if (session.roomid){
					v.controls = true;
					
					session.requestRateLimit(100,UUID);// limit resolution for guests
					
					updateMixer(); 
				}
				
				v.addEventListener('click', function(e) { // show stats of video if double clicked
					log("click");
					try {
						if ((e.ctrlKey)||(e.metaKey)){
							e.preventDefault();
							var uid = e.currentTarget.dataset.UUID;
							if ("stats" in session.rpcs[uid]){
								log(session.rpcs[uid].stats);
								var menu = document.createElement("div");
								menu.style.left="100px";
								menu.style.top="100px";
								menu.style.width="300px";
								menu.style.minHeight="200px";
								menu.style.backgroundColor="white";
								menu.style.position="absolute";
								menu.style.zIndex="20";
								//menu.id = "stats_"+e.currentTarget.dataset.UUID
								document.getElementById('main').appendChild(menu);
								menu.innerHTML = "";
								
								session.printStats(uid, menu);
								menu.interval = setInterval(session.printStats,5000, uid, menu);
								menu.addEventListener('click', function(e) { 
									clearInterval(e.currentTarget.interval);
									e.currentTarget.parentNode.removeChild(e.currentTarget);
								});
								
							}
							e.stopPropagation();
							return false;
						}
					} catch(e){errorlog(e);}
					
					
				});
				
				
				if (session.remote){
					v.addEventListener("wheel", session.remoteControl);
				}
				
				if (v.controls == false){
					v.addEventListener("click", function clicktoplayfunc() {
						v.play().then(_ => {
						  log("playing");
						})
						.catch(error => {
						  errorlog("didnt autoplay");
						});
					});
					if (session.nocursor==false){ // we do not want to show the controls. This is because MacOS + OBS does not work; so electron app needs this.
						setTimeout(function timeoutnocusorcontrol(){v.controls=true;},3000); // 3 seconds before I enable the controls automatically. This way it doesn't auto appear during loading.  3s enough, right?
					}
					
					v.play().then(_ => {
						log("playing");
					}).catch(error => {
						errorlog("didnt autoplay");
					});
				}
				
				
				setTimeout(session.processStats, 1000, UUID);
				
			}
		};
		log("setup peer complete");
	};


	return session;
})();
