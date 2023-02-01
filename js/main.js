import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {mergeBufferGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GUI} from 'three/addons/libs/lil-gui.module.min.js';

const container = document.querySelector('.container');
const boxCanvas = document.querySelector('#box-canvas');

let box = {
    params: {
        width: 27,
        widthLimits: [15, 70],
        length: 80,
        lengthLimits: [70, 120],
        depth: 45,
        depthLimits: [15, 70],
        thickness: .6,
        thicknessLimits: [.1, 1],
        fluteFreq: 5,
        fluteFreqLimits: [3, 7],
        flapGap: 1,
        copyrightSize: [27, 10]
    },
    els: {
        group: new THREE.Group(),
        backHalf: {
            width: {
                top: new THREE.Mesh(),
                side: new THREE.Mesh(),
                bottom: new THREE.Mesh(),
            },
            length: {
                top: new THREE.Mesh(),
                side: new THREE.Mesh(),
                bottom: new THREE.Mesh(),
            },
        },
        frontHalf: {
            width: {
                top: new THREE.Mesh(),
                side: new THREE.Mesh(),
                bottom: new THREE.Mesh(),
            },
            length: {
                top: new THREE.Mesh(),
                side: new THREE.Mesh(),
                bottom: new THREE.Mesh(),
            },
        }
    },
    animated: {
        openingAngle: .02 * Math.PI,
        flapAngles: {
            backHalf: {
                width: {
                    top: 0,
                    bottom: 0
                },
                length: {
                    top: 0,
                    bottom: 0
                },
            },
            frontHalf: {
                width: {
                    top: 0,
                    bottom: 0
                },
                length: {
                    top: 0,
                    bottom: 0
                },
            }
        }
    }
};

// Globals
let renderer, scene, camera, orbit, lightHolder, rayCaster, mouse, copyright;

// Run the app
initScene();
createControls();
window.addEventListener('resize', updateSceneSize);


// --------------------------------------------------
// Three.js scene

function initScene() {

    renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas: boxCanvas
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 10, 1000);
    camera.position.set(40, 90, 110);

    rayCaster = new THREE.Raycaster();
    mouse = new THREE.Vector2(0, 0);

    updateSceneSize();

    scene.add(box.els.group);
    setGeometryHierarchy();

    const ambientLight = new THREE.AmbientLight(0xffffff, .5);
    scene.add(ambientLight);
    lightHolder = new THREE.Group();
    const topLight = new THREE.PointLight(0xffffff, .5);
    topLight.position.set(-30, 300, 0);
    lightHolder.add(topLight);
    const sideLight = new THREE.PointLight(0xffffff, .7);
    sideLight.position.set(50, 0, 150);
    lightHolder.add(sideLight);
    scene.add(lightHolder);

    scene.add(box.els.group);
    setGeometryHierarchy();

    const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x9C8D7B),
        side: THREE.DoubleSide
    });
    box.els.group.traverse(c => {
        if (c.isMesh) c.material = material;
    });

    orbit = new OrbitControls(camera, boxCanvas);
    orbit.enableZoom = false;
    orbit.enablePan = false;
    orbit.enableDamping = true;
    orbit.autoRotate = true;
    orbit.autoRotateSpeed = .25;

    createCopyright();
    createBoxElements();
    createFoldingAnimation();
    createZooming();

    render();
}

function render() {
    orbit.update();
    lightHolder.quaternion.copy(camera.quaternion);
    renderer.render(scene, camera);
    requestAnimationFrame(render);
}

function updateSceneSize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// End of Three.js scene
// --------------------------------------------------


// --------------------------------------------------
// Box geometries

function setGeometryHierarchy() {
    box.els.group.add(box.els.frontHalf.width.side, box.els.frontHalf.length.side, box.els.backHalf.width.side, box.els.backHalf.length.side);
    box.els.frontHalf.width.side.add(box.els.frontHalf.width.top, box.els.frontHalf.width.bottom);
    box.els.frontHalf.length.side.add(box.els.frontHalf.length.top, box.els.frontHalf.length.bottom);
    box.els.backHalf.width.side.add(box.els.backHalf.width.top, box.els.backHalf.width.bottom);
    box.els.backHalf.length.side.add(box.els.backHalf.length.top, box.els.backHalf.length.bottom);
}

function createBoxElements() {
    for (let halfIdx = 0; halfIdx < 2; halfIdx++) {
        for (let sideIdx = 0; sideIdx < 2; sideIdx++) {

            const half = halfIdx ? 'frontHalf' : 'backHalf';
            const side = sideIdx ? 'width' : 'length';

            const sideWidth = side === 'width' ? box.params.width : box.params.length;
            const flapWidth = sideWidth - 2 * box.params.flapGap;
            const flapHeight = .5 * box.params.width - .75 * box.params.flapGap;

            const sidePlaneGeometry = new THREE.PlaneGeometry(
                sideWidth,
                box.params.depth,
                Math.floor(5 * sideWidth),
                Math.floor(.2 * box.params.depth)
            );
            const flapPlaneGeometry = new THREE.PlaneGeometry(
                flapWidth,
                flapHeight,
                Math.floor(5 * flapWidth),
                Math.floor(.2 * flapHeight)
            );

            const sideGeometry = createSideGeometry(
                sidePlaneGeometry,
                [sideWidth, box.params.depth],
                [true, true, true, true],
                false
            );
            const topGeometry = createSideGeometry(
                flapPlaneGeometry,
                [flapWidth, flapHeight],
                [false, false, true, false],
                true
            );
            const bottomGeometry = createSideGeometry(
                flapPlaneGeometry,
                [flapWidth, flapHeight],
                [true, false, false, false],
                true
            );

            topGeometry.translate(0, .5 * flapHeight, 0);
            bottomGeometry.translate(0, -.5 * flapHeight, 0);

            box.els[half][side].top.geometry = topGeometry;
            box.els[half][side].side.geometry = sideGeometry;
            box.els[half][side].bottom.geometry = bottomGeometry;

            box.els[half][side].top.position.y = .5 * box.params.depth;
            box.els[half][side].bottom.position.y = -.5 * box.params.depth;
        }
    }

    updatePanelsTransform();
}

function createSideGeometry(baseGeometry, size, folds, hasMiddleLayer) {
    const geometriesToMerge = [];
    geometriesToMerge.push(getLayerGeometry(v =>
        -.5 * box.params.thickness + .01 * Math.sin(box.params.fluteFreq * v)
    ));
    geometriesToMerge.push(getLayerGeometry(v =>
        .5 * box.params.thickness + .01 * Math.sin(box.params.fluteFreq * v)
    ));
    if (hasMiddleLayer) {
        geometriesToMerge.push(getLayerGeometry(v =>
            .5 * box.params.thickness * Math.sin(box.params.fluteFreq * v)
        ));
    }

    function getLayerGeometry(offset) {
        const layerGeometry = baseGeometry.clone();
        const positionAttr = layerGeometry.attributes.position;
        for (let i = 0; i < positionAttr.count; i++) {
            const x = positionAttr.getX(i);
            const y = positionAttr.getY(i)
            let z = positionAttr.getZ(i) + offset(x);
            z = applyFolds(x, y, z);
            positionAttr.setXYZ(i, x, y, z);
        }
        return layerGeometry;
    }

    function applyFolds(x, y, z) {
        let modifier = (c, s) => (1. - Math.pow(c / (.5 * s), 10.));
        if ((x > 0 && folds[1]) || (x < 0 && folds[3])) {
            z *= modifier(x, size[0]);
        }
        if ((y > 0 && folds[0]) || (y < 0 && folds[2])) {
            z *= modifier(y, size[1]);
        }
        return z;
    }

    const mergedGeometry = new mergeBufferGeometries(geometriesToMerge, false);
    mergedGeometry.computeVertexNormals();

    return mergedGeometry;
}

// End of box geometries
// --------------------------------------------------

// --------------------------------------------------
// Clickable copyright

function createCopyright() {
    const canvas = document.createElement('canvas');
    canvas.width = box.params.copyrightSize[0] * 10;
    canvas.height = box.params.copyrightSize[1] * 10;
    const planeGeometry = new THREE.PlaneGeometry(box.params.copyrightSize[0], box.params.copyrightSize[1]);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.width);
    ctx.fillStyle = '#000000';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'end';
    ctx.fillText('ksenia-k.com', canvas.width - 30, 30);
    ctx.fillText('codepen.io/ksenia-k', canvas.width - 30, 70);

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width - 160, 35);
    ctx.lineTo(canvas.width - 30, 35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(canvas.width - 228, 77);
    ctx.lineTo(canvas.width - 30, 77);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    copyright = new THREE.Mesh(planeGeometry, new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: .5
    }));

    scene.add(copyright);
    trackLinks();
}

function trackLinks() {
    document.addEventListener('mousemove', (e) => {
        updateMousePosition(e.clientX, e.clientY);
        checkCopyrightIntersect();
    }, false);
    document.addEventListener('click', (e) => {
        updateMousePosition(
            e.targetTouches ? e.targetTouches[0].pageX : e.clientX,
            e.targetTouches ? e.targetTouches[0].pageY : e.clientY
        );
        const linkCode = checkCopyrightIntersect();
        if (linkCode === 1) {
            window.open('https://ksenia-k.com/', '_blank').focus();
        } else if (linkCode === 2) {
            window.open('https://codepen.io/ksenia-k/', '_blank').focus();
        }
    });

    function updateMousePosition(x, y) {
        mouse.x = x / window.innerWidth * 2 - 1;
        mouse.y = -y / window.innerHeight * 2 + 1;
    }
}

function checkCopyrightIntersect() {
    let linkHovered = 0;
    rayCaster.setFromCamera(mouse, camera);
    const intersects = rayCaster.intersectObject(copyright);
    if (intersects.length) {
        document.body.style.cursor = 'pointer';
        linkHovered = intersects[0].uv.y > .5 ? 1 : 2;
    } else {
        document.body.style.cursor = 'auto';
    }
    return linkHovered;
}

// End of Clickable copyright
// --------------------------------------------------

// --------------------------------------------------
// Animation

function createFoldingAnimation() {
    gsap.timeline({
        scrollTrigger: {
            trigger: '.page',
            start: '0% 0%',
            end: '100% 100%',
            scrub: true,
        },
        onUpdate: () => {
            updatePanelsTransform();
            checkCopyrightIntersect();
        }
    })
        .to(box.animated, {
            duration: 1,
            openingAngle: .5 * Math.PI,
            ease: 'power1.inOut'
        })
        .to([box.animated.flapAngles.backHalf.width, box.animated.flapAngles.frontHalf.width], {
            duration: .6,
            bottom: .6 * Math.PI,
            ease: 'back.in(3)'
        }, .9)
        .to(box.animated.flapAngles.backHalf.length, {
            duration: .7,
            bottom: .5 * Math.PI,
            ease: 'back.in(2)'
        }, 1.1)
        .to(box.animated.flapAngles.frontHalf.length, {
            duration: .8,
            bottom: .49 * Math.PI,
            ease: 'back.in(3)'
        }, 1.4)
        .to([box.animated.flapAngles.backHalf.width, box.animated.flapAngles.frontHalf.width], {
            duration: .6,
            top: .6 * Math.PI,
            ease: 'back.in(3)'
        }, 1.4)
        .to(box.animated.flapAngles.backHalf.length, {
            duration: .7,
            top: .5 * Math.PI,
            ease: 'back.in(3)'
        }, 1.7)
        .to(box.animated.flapAngles.frontHalf.length, {
            duration: .9,
            top: .49 * Math.PI,
            ease: 'back.in(4)'
        }, 1.8)
}

function updatePanelsTransform() {
    // place width-sides aside of length-sides (not animated)
    box.els.frontHalf.width.side.position.x = .5 * box.params.length;
    box.els.backHalf.width.side.position.x = -.5 * box.params.length;

    // rotate width-sides from 0 to 90 deg
    box.els.frontHalf.width.side.rotation.y = box.animated.openingAngle;
    box.els.backHalf.width.side.rotation.y = box.animated.openingAngle;

    // move length-sides to keep the box centered
    const cos = Math.cos(box.animated.openingAngle); // animates from 1 to 0
    box.els.frontHalf.length.side.position.x = -.5 * cos * box.params.width;
    box.els.backHalf.length.side.position.x = .5 * cos * box.params.width;

    // move length-sides to define box inner space
    const sin = Math.sin(box.animated.openingAngle); // animates from 0 to 1
    box.els.frontHalf.length.side.position.z = .5 * sin * box.params.width;
    box.els.backHalf.length.side.position.z = -.5 * sin * box.params.width;

    box.els.frontHalf.width.top.rotation.x = -box.animated.flapAngles.frontHalf.width.top;
    box.els.frontHalf.length.top.rotation.x = -box.animated.flapAngles.frontHalf.length.top;
    box.els.frontHalf.width.bottom.rotation.x = box.animated.flapAngles.frontHalf.width.bottom;
    box.els.frontHalf.length.bottom.rotation.x = box.animated.flapAngles.frontHalf.length.bottom;

    box.els.backHalf.width.top.rotation.x = box.animated.flapAngles.backHalf.width.top;
    box.els.backHalf.length.top.rotation.x = box.animated.flapAngles.backHalf.length.top;
    box.els.backHalf.width.bottom.rotation.x = -box.animated.flapAngles.backHalf.width.bottom;
    box.els.backHalf.length.bottom.rotation.x = -box.animated.flapAngles.backHalf.length.bottom;

    copyright.position.copy(box.els.frontHalf.length.side.position);
    copyright.position.x += .5 * box.params.length - .5 * box.params.copyrightSize[0];
    copyright.position.y -= .5 * (box.params.depth - box.params.copyrightSize[1]);
    copyright.position.z += box.params.thickness;
}

// End of animation
// --------------------------------------------------


// --------------------------------------------------
// Manual zoom (buttons only since the scroll is used
// by folding animation)

function createZooming() {
    const zoomInBtn = document.querySelector('#zoom-in');
    const zoomOutBtn = document.querySelector('#zoom-out');

    let zoomLevel = 1;
    const limits = [.4, 2];

    zoomInBtn.addEventListener('click', () => {
        zoomLevel *= 1.3;
        applyZoomLimits();
    });
    zoomOutBtn.addEventListener('click', () => {
        zoomLevel *= .75;
        applyZoomLimits();
    });

    function applyZoomLimits() {
        if (zoomLevel > limits[1]) {
            zoomLevel = limits[1];
            zoomInBtn.classList.add('disabled');
        } else if (zoomLevel < limits[0]) {
            zoomLevel = limits[0];
            zoomOutBtn.classList.add('disabled');
        } else {
            zoomInBtn.classList.remove('disabled');
            zoomOutBtn.classList.remove('disabled');
        }
        gsap.to(camera, {
            duration: .2,
            zoom: zoomLevel,
            onUpdate: () => {
                camera.updateProjectionMatrix();
            }
        })
    }
}

// End of Manual zoom
// --------------------------------------------------

// --------------------------------------------------
// Range sliders for box parameters

function createControls() {
    const gui = new GUI();
    gui.add(box.params, 'width', box.params.widthLimits[0], box.params.widthLimits[1]).step(1).onChange(() => {
        createBoxElements();
        updatePanelsTransform();
    });
    gui.add(box.params, 'length', box.params.lengthLimits[0], box.params.lengthLimits[1]).step(1).onChange(() => {
        createBoxElements();
        updatePanelsTransform();
    });
    gui.add(box.params, 'depth', box.params.depthLimits[0], box.params.depthLimits[1]).step(1).onChange(() => {
        createBoxElements();
        updatePanelsTransform();
    });
    gui.add(box.params, 'fluteFreq', box.params.fluteFreqLimits[0], box.params.fluteFreqLimits[1]).step(1).onChange(() => {
        createBoxElements();
    }).name('flute');
    gui.add(box.params, 'thickness', box.params.thicknessLimits[0], box.params.thicknessLimits[1]).step(.05).onChange(() => {
        createBoxElements();
    });
}

// End Range sliders for box parameters
// --------------------------------------------------