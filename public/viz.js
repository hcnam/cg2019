/**
 * dat.globe Javascript WebGL Globe Toolkit
 * https://github.com/dataarts/webgl-globe
 *
 * Copyright 2011 Data Arts Team, Google Creative Lab
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */
/**
 * edited by Hocheol, Nam
 * in 2019
 */

var DAT = DAT || {};

DAT.Sphere = function(container, opts) {
  opts = opts || {};
  
  // 색 설정
  var setColor = opts.setColor || function(x) {
    var c = new THREE.Color();
    // 데이터 값에 따라 처리
    c.setHSL((0.5 - (x*0.6)), 1.0, 0.5);
    return c;
  };

  // 쉐이더 설정
  var Shaders = {
    'earth' : {
      uniforms: {
        'texture': { 
          type: 't', 
          value: null }
      },
      // vertex shader 부분
      vertexShader: [
        'varying vec3 vNormal;',
        'varying vec2 vUv;',
        'void main() {',
          'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
          'vNormal = normalize( normalMatrix * normal );',
          'vUv = uv;',
        '}'
      ].join('\n'),
      // fragment shader 부분
      fragmentShader: [
        'uniform sampler2D texture;',
        'varying vec3 vNormal;',
        'varying vec2 vUv;',
        'void main() {',
          'vec3 diffuse = texture2D( texture, vUv ).xyz;',
          'float intensity = 1.05 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) );',
          'vec3 atmosphere = vec3( 1.0, 1.0, 1.0 ) * pow( intensity, 3.0 );',
          'gl_FragColor = vec4( diffuse + atmosphere, 1.0 );',
        '}'
      ].join('\n')
    },
    'atmosphere' : {
      uniforms: {},
      vertexShader: [
        'varying vec3 vNormal;',
        'void main() {',
          'vNormal = normalize( normalMatrix * normal );',
          'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vNormal;',
        'void main() {',
          'float intensity = pow( 0.8 - dot( vNormal, vec3( 0, 0, 1.0 ) ), 12.0 );',
          'gl_FragColor = vec4( 1.0, 1.0, 1.0, 1.0 ) * intensity;',
        '}'
      ].join('\n')
    }
  };

  var camera, scene, renderer, w, h;
  var mesh, atmosphere, point;

  var overRenderer;

  var curZoomSpeed = 0;
  var zoomSpeed = 50;

  var mouse = { x: 0, y: 0 }, mouseOnDown = { x: 0, y: 0 };
  var rotation = { x: 0, y: 0 },
      target = { x: Math.PI*3/2, y: Math.PI / 6.0 },
      targetOnDown = { x: 0, y: 0 };

  var distance = 100000, distanceTarget = 100000;
  var padding = 40;
  var PI_HALF = Math.PI / 2;

  function init() {
    container.style.color = '#fff';
    container.style.font = '13px/20px Arial, sans-serif';
    var shader, uniforms, material;
    w = container.offsetWidth || window.innerWidth;
    h = container.offsetHeight || window.innerHeight;

    // 카메라 생성
    camera = new THREE.PerspectiveCamera(30, w / h, 1, 10000);
    camera.position.z = distance;
    scene = new THREE.Scene();
    // 구 생성
    var geometry = new THREE.SphereGeometry(200, 40, 30);
    // 쉐이더는 위의 earth로 설정
    shader = Shaders['earth'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);
    // 텍스처 설정
    uniforms['texture'].value = THREE.ImageUtils.loadTexture('./water_4k2.png');
    material = new THREE.ShaderMaterial({
          uniforms: uniforms,
          vertexShader: shader.vertexShader,
          fragmentShader: shader.fragmentShader
        });

    // 생성한 구를 mesh로 세팅
    mesh = new THREE.Mesh(geometry, material);
    // 회전은 y축 중심 
    mesh.rotation.y = Math.PI;
    // scene에 mesh 추가
    scene.add(mesh);

    // shader는 위의 atmosphere로 설정(대기층 표현용)
    shader = Shaders['atmosphere'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);
    material = new THREE.ShaderMaterial({
          uniforms: uniforms,
          vertexShader: shader.vertexShader,
          fragmentShader: shader.fragmentShader,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          transparent: true
        });
    
    // 구를 하나더 마테리얼로 추가해서 구체의 바운더리가 빛나는듯한 효과를 준다.(대기권 표현)
    mesh = new THREE.Mesh(geometry, material);
    // 기존 구 보다 약간 크게 설정(구를 감싸는 빛 같은 느낌을 준다.)
    mesh.scale.set( 1.1, 1.1, 1.1 );
    scene.add(mesh);

    // 그래프를 올리기 위한 mesh 설정
    geometry = new THREE.BoxGeometry(0.75, 0.75, 1, 6);
    geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0,0,-0.5));
    material = new THREE.MeshPhongMaterial({ color: 0xffffff });
    point = new THREE.Mesh(geometry, material);

    ///////////////////   Lighting   /////////////////////
    hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.6 );
    hemiLight.color.setHSL( 0.6, 1, 0.6 );
    hemiLight.groundColor.setHSL( 0.095, 1, 0.75 );
    hemiLight.position.set( 0, 500, 0 );
    scene.add( hemiLight );

    dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
    dirLight.color.setHSL( 0.1, 1, 0.95 );
    dirLight.position.set( 300, 300, 0 );
    dirLight.position.multiplyScalar( 50 );
    scene.add( dirLight );

    // 렌더링
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(w, h);
    renderer.setClearColor (0x222222, 1);
    renderer.domElement.style.position = 'absolute';

    container.appendChild(renderer.domElement);
    // 마우스 키보드 이벤트 설정
    container.addEventListener('mousedown', onMouseDown, false);
    container.addEventListener('mousewheel', onMouseWheel, false);
    document.addEventListener('keydown', onDocumentKeyDown, false);
    window.addEventListener('resize', onWindowResize, false);
    container.addEventListener('mouseover', function() {
      overRenderer = true;
    }, false);
    container.addEventListener('mouseout', function() {
      overRenderer = false;
    }, false);

  }
  
  // 마우스 이벤트 조절
  function onMouseDown(event) {
    event.preventDefault();
    container.addEventListener('mousemove', onMouseMove, false);
    container.addEventListener('mouseup', onMouseUp, false);
    container.addEventListener('mouseout', onMouseOut, false);
    mouseOnDown.x = - event.clientX;
    mouseOnDown.y = event.clientY;
    targetOnDown.x = target.x;
    targetOnDown.y = target.y;
    container.style.cursor = 'move';
  }

  // 마우스 이동
  function onMouseMove(event) {
    mouse.x = - event.clientX;
    mouse.y = event.clientY;
    var zoomDamp = distance/1000;
    target.x = targetOnDown.x + (mouse.x - mouseOnDown.x) * 0.005 * zoomDamp;
    target.y = targetOnDown.y + (mouse.y - mouseOnDown.y) * 0.005 * zoomDamp;
    target.y = target.y > PI_HALF ? PI_HALF : target.y;
    target.y = target.y < - PI_HALF ? - PI_HALF : target.y;
  }

  // 마우스 이벤트 조절
  function onMouseUp(event) {
    container.removeEventListener('mousemove', onMouseMove, false);
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);
    container.style.cursor = 'auto';
  }

  function onMouseOut(event) {
    container.removeEventListener('mousemove', onMouseMove, false);
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);
  }

  // 마우스 휠 이용 줌 조절
  function onMouseWheel(event) {
    event.preventDefault();
    if (overRenderer) {
      zoom(event.wheelDeltaY * 0.3);
    }
    return false;
  }

  // up&down 키를 이용한 줌 조절
  function onDocumentKeyDown(event) {
    switch (event.keyCode) {
      case 38:
        zoom(100);
        event.preventDefault();
        break;
      case 40:
        zoom(-100);
        event.preventDefault();
        break;
    }
  }

  function onWindowResize( event ) {
    camera.aspect = container.offsetWidth / container.offsetHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( container.offsetWidth, container.offsetHeight );
  }

  // zoom 당길수 있는 거리 조절
  function zoom(delta) {
    distanceTarget -= delta;
    // 최대 1000까지(1000보다 크면 1000으로 되돌림)
    distanceTarget = distanceTarget > 1000 ? 1000 : distanceTarget;
    // 최소 240까지(240보다 작으면 240으로 되돌림)
    // 200 이하로 내리면 텍스처를 뚫고 지나감
    distanceTarget = distanceTarget < 240 ? 240 : distanceTarget;
  }

  // 애니메이션 설정
  function animate() {
    requestAnimationFrame(animate);
    render();
  }

  function render() {
    zoom(curZoomSpeed);
    rotation.x += (target.x - rotation.x) * 0.1;
    rotation.y += (target.y - rotation.y) * 0.1;
    distance += (distanceTarget - distance) * 0.3;
    // 카메라 포지션 조정
    camera.position.x = distance * Math.sin(rotation.x) * Math.cos(rotation.y);
    camera.position.y = distance * Math.sin(rotation.y);
    camera.position.z = distance * Math.cos(rotation.x) * Math.cos(rotation.y);
    // 카메라 lookAt함수
    camera.lookAt(mesh.position);
    renderer.render(scene, camera);
  }

///////////////////////////////////////////////////////////////////
//                       데이터 처리부
///////////////////////////////////////////////////////////////////

  // 데이터 추가
  function addData(data, opts) {
    // 데이터 읽거들어와 체크
    var lat, lng, size, color, i, step, setColorWrapper;
    step = 3; // 3개씩 읽는다.
    setColorWrapper = function(data, i) { 
      return setColor(data[i+2]); 
    }
    
    this._baseGeometry = new THREE.Geometry();
    for (i = 0; i < data.length; i += step) {
      lat = data[i];
      lng = data[i + 1];
      color = setColorWrapper(data,i);
      size = 0;
      addGraph(lat, lng, size, color, this._baseGeometry);
    }
    opts.name = opts.name || 'morphTarget'+this._morphTargetId;

    var sub = new THREE.Geometry();
    for (i = 0; i < data.length; i += step) {
      lat = data[i];
      lng = data[i + 1];
      color = setColorWrapper(data,i);
      size = data[i + 2]*200;
      addGraph(lat, lng, size, color, sub);
    }
    this._baseGeometry.morphTargets.push({'name': opts.name, vertices: sub.vertices});
  };

  // 그래프 생성용 함수
  function createGraphs() {
    if (this._baseGeometry !== undefined) {
      if (this._baseGeometry.morphTargets.length < 8) {
        var padding = 8-this._baseGeometry.morphTargets.length;
        //console.log('padding', padding);
        for(var i=0; i<=padding; i++) {
          //console.log('padding',i);
          this._baseGeometry.morphTargets.push({'name': 'morphPadding'+i, vertices: this._baseGeometry.vertices});
        }
      }
      this.points = new THREE.Mesh(this._baseGeometry, new THREE.MeshPhongMaterial({
            color: 0xffffff,
            vertexColors: THREE.FaceColors,
            morphTargets: true
          }));
      scene.add(this.points);
    }
  }

  // 그래프 추가
  function addGraph(lat, lng, size, color, sub) {
    // 위치 조정 (lat, lng -> x,y,z)
    var phi = (90 - lat) * Math.PI / 180;
    var theta = (180 - lng) * Math.PI / 180;

    point.position.x = 200 * Math.sin(phi) * Math.cos(theta);
    point.position.y = 200 * Math.cos(phi);
    point.position.z = 200 * Math.sin(phi) * Math.sin(theta);

    point.lookAt(mesh.position);
    point.scale.z = Math.max( size, 0.1 ); 
    point.updateMatrix();

    // 색 조정
    for (var i = 0; i < point.geometry.faces.length; i++) {
      point.geometry.faces[i].color = color;
    }
    if(point.matrixAutoUpdate){
      point.updateMatrix();
    }
    sub.merge(point.geometry, point.matrix);
  }

  init();
  this.animate = animate;


  this.__defineGetter__('time', function() {
    return this._time || 0;
  });

  this.__defineSetter__('time', function(t) {
    var validMorphs = [];
    var morphDict = this.points.morphTargetDictionary;
    for(var k in morphDict) {
      if(k.indexOf('morphPadding') < 0) {
        validMorphs.push(morphDict[k]);
      }
    }
    validMorphs.sort();
    var l = validMorphs.length-1;
    var scaledt = t*l+1;
    var index = Math.floor(scaledt);
    for (i=0;i<validMorphs.length;i++) {
      this.points.morphTargetInfluences[validMorphs[i]] = 0;
    }
    var lastIndex = index - 1;
    var leftover = scaledt - index;
    if (lastIndex >= 0) {
      this.points.morphTargetInfluences[lastIndex] = 1 - leftover;
    }
    this.points.morphTargetInfluences[index] = leftover;
    this._time = t;
  });

  this.addData = addData;
  this.createGraphs = createGraphs;
  this.renderer = renderer;
  this.scene = scene;

  return this;

};

