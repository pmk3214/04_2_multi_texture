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
                'vec2 flow = mask * vec2(0.02, 0.01);',
                'vec4 texColor0 = texture(samplerColor, vTexCoord + weight * flow);',
                'vec4 texColor1 = texture(samplerColor, vTexCoord + fract(weight+0.5) * flow);',
                'outColor = mix(texColor1, texColor0, weight);',
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
        var texture_color = null;
        load_texture('texture.png', texture_color);
        var texture_mask = null;
        load_texture('mask.png', texture_mask);

        window.requestAnimationFrame(update);
        
        ////////////////////////////
        // フレームの更新
        ////////////////////////////
        var lastTime = null;
        function update(timestamp){
            // 更新間隔の取得
            var elapsedTime = lastTime ? timestamp - lastTime : 0;
            lastTime = timestamp;
            
            ////////////////////////////
            // 動かす
            ////////////////////////////
            
            ////////////////////////////
            // 描画
            ////////////////////////////
            // 画面クリア
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            
            // ポリゴンの描画
            if (texture_color !== null && texture_mask !== null) {
                gl.bindTexture(gl.TEXTURE_2D, texture_color);// テクスチャを有効にする
                gl.activeTexture(gl.TEXTURE0);// 0番のテクスチャを有効にする
                gl.uniform1i(uniLocations[1], 0);// シェーダの'samplerColor'に0番を割り当てる
                gl.uniform1i(uniLocations[2], 1);// シェーダの'samplerMask'に1番を割り当てる
                gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
                gl.drawArrays(gl.TRIANGLES, 0, 6);// 2個の三角形を表示
            }
            
            gl.flush();// 画面更新

            // ブラウザに再描画時にアニメーションの更新を要求
            window.requestAnimationFrame(update);
        }
        
        function load_texture(source, texture){
            var img = new Image();// 画像オブジェクトの生成

            img.onload = function(texture){// 画像が読み込まれた際の処理
                var tex = gl.createTexture();// テクスチャオブジェクトの生成
                gl.bindTexture(gl.TEXTURE_2D, tex);// テクスチャをバインド
                // テクスチャへ画像を写す
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
                gl.bindTexture(gl.TEXTURE_2D, null);// バインドを外す
                texture = tex; // 生成したテクスチャをグローバル変数に代入
            };
            img.src = source;// 画像ファイルを指定して読み込む
        }
        
    }, false);
})();
