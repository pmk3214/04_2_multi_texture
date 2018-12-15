(function(){
    'use strict';

    // 変数
    var gl, canvas;

    window.addEventListener('load', function(){
        ////////////////////////////
        // 初期化
        ////////////////////////////
        
        // canvas の初期化
        canvas = document.getElementById('canvas');
        canvas.width = 512;
        canvas.height = 512;

        // WeebGLの初期化(WebGL 2.0)
        gl = canvas.getContext('webgl2');

        // シェーダプログラムの初期化
        // 頂点シェーダ
        var vsSource = [
            '#version 300 es',
            'in vec2 position;',
            'in vec2 texture_coord;',
            
            'out vec2 vTexCoord;',

            'void main(void) {',
                'gl_Position = vec4(position, 0.0, 1.0);',
                'vTexCoord = texture_coord;',
            '}'
        ].join('\n');

        var vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vsSource);
        gl.compileShader(vertexShader);
        if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)){
            alert(gl.getShaderInfoLog(vertexShader));
        }

        // フラグメントシェーダ
        var fsSource = [
            '#version 300 es',
            'precision highp float;',
            
            'uniform sampler2D samplerColor;',
            'uniform sampler2D samplerMask;',
            'uniform float weight;',
            'in vec2 vTexCoord;',
            
            'out vec4 outColor;',

            'void main(void) {',
                'float mask = texture(samplerMask, vTexCoord).x;',
                'vec2 flow = mask * vec2(-0.02, 0.01);',
                'vec4 texColor0 = texture(samplerColor, vTexCoord + weight * flow);',
                'vec4 texColor1 = texture(samplerColor, vTexCoord + fract(weight+0.5) * flow);',
                'outColor = mix(texColor0, texColor1, abs(2.0 * weight - 1.0));',
            '}'
        ].join('\n');

        var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fsSource);
        gl.compileShader(fragmentShader);
        if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)){
            alert(gl.getShaderInfoLog(fragmentShader));
        }

        // シェーダ「プログラム」の初期化
        var program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
            alert(gl.getProgramInfoLog(program));
            return;
        }
        
        var uniLocations = [];
        uniLocations[0]  = gl.getUniformLocation(program, 'weight');
        uniLocations[1]  = gl.getUniformLocation(program, 'samplerColor');
        uniLocations[2]  = gl.getUniformLocation(program, 'samplerMask');
        
        gl.useProgram(program);

        // モデルの構築
        var vertex_data = new Float32Array([
         // x     y     u    v
          +1.0, +1.0,  1.0, 0.0,
          -1.0, +1.0,  0.0, 0.0,
          +1.0, -1.0,  1.0, 1.0,

          +1.0, -1.0,  1.0, 1.0,
          -1.0, +1.0,  0.0, 0.0,
          -1.0, -1.0,  0.0, 1.0,
        ]);
        
        var byteLength = 4 * 4; // 頂点は4バイト×4個
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertex_data, gl.STATIC_DRAW);
        var posAttr = gl.getAttribLocation(program, 'position');
        var uvAttr = gl.getAttribLocation(program, 'texture_coord');
        gl.enableVertexAttribArray(posAttr);
        gl.enableVertexAttribArray(uvAttr);
        gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, byteLength, 0);
        gl.vertexAttribPointer(uvAttr, 2, gl.FLOAT, false, byteLength, 4*2);//位置データ(4バイト)2つに続くデータ
        gl.bindBuffer(gl.ARRAY_BUFFER, null);        // 悪さされないようにバッファを外す
        
        // テクスチャの読み込み
        load_resources([
            'texture.png',
            'mask.png',
        ], after_load);
        
        var texture_color = null;
        var texture_mask = null;
        function after_load(resources)
        {
            var tex_color = gl.createTexture();// テクスチャオブジェクトの生成
            gl.bindTexture(gl.TEXTURE_2D, tex_color);// テクスチャをバインド
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, resources['texture.png']);// テクスチャへ画像を写す
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            texture_color = tex_color; // 生成したテクスチャをグローバル変数に代入
            
            var tex_mask = gl.createTexture();// テクスチャオブジェクトの生成
            gl.bindTexture(gl.TEXTURE_2D, tex_mask);// テクスチャをバインド
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, resources['mask.png']);// テクスチャへ画像を写す
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            texture_mask = tex_mask; // 生成したテクスチャをグローバル変数に代入

            gl.bindTexture(gl.TEXTURE_2D, null);// バインドを外す
            
            window.requestAnimationFrame(update);
        }
        
        ////////////////////////////
        // フレームの更新
        ////////////////////////////
        var lastTime = null;
        var weight = 0.0;
        function update(timestamp){
            // 更新間隔の取得
            var elapsedTime = lastTime ? timestamp - lastTime : 0;
            lastTime = timestamp;
            
            ////////////////////////////
            // 動かす
            ////////////////////////////
            weight += 0.0001 * elapsedTime;
            while(1.0 < weight) weight -= 1.0;// weight % 1
            
            ////////////////////////////
            // 描画
            ////////////////////////////
            // 画面クリア
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            
            // ポリゴンの描画
            gl.uniform1i(uniLocations[1], 0);// シェーダの'samplerColor'に0番を割り当てる
            gl.activeTexture(gl.TEXTURE0);// 0番のテクスチャを有効にする
            gl.bindTexture(gl.TEXTURE_2D, texture_color);// テクスチャを有効にする
            gl.uniform1i(uniLocations[2], 1);// シェーダの'samplerMask'に1番を割り当てる
            gl.activeTexture(gl.TEXTURE1);// 1番のテクスチャを有効にする
            gl.bindTexture(gl.TEXTURE_2D, texture_mask);// テクスチャを有効にする
            gl.uniform1f(uniLocations[0], weight);// 動きの重みを渡す
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
            gl.drawArrays(gl.TRIANGLES, 0, 6);// 2個の三角形を表示
            
            gl.flush();// 画面更新

            // ブラウザに再描画時にアニメーションの更新を要求
            window.requestAnimationFrame(update);
        }
        
        function load_resources(sources, texture){
            var img = new Image();// 画像オブジェクトの生成

            img.onload = function(texture){// 画像が読み込まれた際の処理
            };
            img.src = source;// 画像ファイルを指定して読み込む
        }
        
        function load_resources(urls, callback) {
          var resources = {};
          var resource_count = urls.length;

          // 各画像のロードが完了するたびに呼び出される関数
          var onResourceLoad = function() {
            --resource_count;
            // 全画像のロードが完了したら、引数で指定されたコールバック関数を呼ぶ。
            if (resource_count == 0) {
              callback(resources);
            }
          };

          for (var ii = 0; ii < resource_count; ++ii) {
            var image = load_resource(urls[ii], onResourceLoad);
            resources[urls[ii]] = image;
          }
        }        
        function load_resource(url, callback) {
            var image = new Image();
            image.src = url;
            image.onload = callback;
            return image;
        }
        
    }, false);
})();
