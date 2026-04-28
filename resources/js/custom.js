// GSAP ScrollTrigger 플러그인 등록
gsap.registerPlugin(ScrollTrigger);

// 터치 디바이스 여부 확인 (모바일/태블릿)
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

// Lenis 스무스 스크롤 초기화
const lenis = new Lenis({
    lerp: 0.15,
    smoothWheel: true,
    smoothTouch: !isTouchDevice,
});

// Lenis와 ScrollTrigger 동기화 및 GSAP ticker 연결
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.lagSmoothing(0);
gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
});
ScrollTrigger.refresh();

const STRIP_COUNT = 30;
const SVG_NS = "http://www.w3.org/2000/svg";

let maskStrips = [];
let masterTimeline;

// SVG 마스크 그룹에 strip(rect) 요소 생성
// - 각 strip은 중앙에서 위아래로 펼쳐지는 rect 두 개로 구성
// - 흰색 rect = 마스크에서 보이는 영역
function createStrips(maskGroupId) {
    const maskGroup = document.getElementById(maskGroupId);
    if (!maskGroup) return null;
    maskGroup.innerHTML = "";

    const viewBoxHeight = (window.innerHeight / window.innerWidth) * 100;
    const stripHeight = viewBoxHeight / STRIP_COUNT;
    const strips = [];
    let offsetY = 0;

    for (let i = 0; i < STRIP_COUNT; i++) {
        const stripCenterY = viewBoxHeight - (offsetY + stripHeight / 2);
        const rectUpper = document.createElementNS(SVG_NS, "rect");
        const rectLower = document.createElementNS(SVG_NS, "rect");

        [rectUpper, rectLower].forEach((r) => {
            r.setAttribute("x", 0);
            r.setAttribute("width", 100);
            r.setAttribute("height", 0);
            r.setAttribute("fill", "white");
            r.setAttribute("shape-rendering", "crispEdges");
        });

        rectUpper.setAttribute("y", stripCenterY);
        rectLower.setAttribute("y", stripCenterY);
        maskGroup.appendChild(rectUpper);
        maskGroup.appendChild(rectLower);

        strips.push({
            top: rectUpper,
            bottom: rectLower,
            y: stripCenterY,
            h: stripHeight / 2
        });

        offsetY += stripHeight;
    }

    return strips;
}

// SVG viewBox 및 마스크 크기를 화면에 맞게 업데이트 후 타임라인 재생성
function updateScene() {
    const viewBoxWidth = 100;
    const viewBoxHeight = (window.innerHeight / window.innerWidth) * 100;
    const scrollLayers = document.querySelectorAll(".scroll-layer");
    maskStrips = [];

    scrollLayers.forEach((svg) => {
        svg.setAttribute("viewBox", `0 0 ${viewBoxWidth} ${viewBoxHeight}`);

        const maskBackground = svg.querySelector("mask rect");
        if (maskBackground) {
            maskBackground.setAttribute("width", viewBoxWidth);
            maskBackground.setAttribute("height", viewBoxHeight);
        }

        const svgImage = svg.querySelector("image");
        if (svgImage) {
            svgImage.setAttribute("width", viewBoxWidth);
            svgImage.setAttribute("height", viewBoxHeight);
        }

        const maskGroupId = svg.querySelector('g[id^="mask-"]').id;
        const strips = createStrips(maskGroupId);
        if (strips) maskStrips.push(strips);
    });

    buildScrollTimeline();
}

// 각 strip을 중앙에서 위아래로 펼치는 애니메이션 타임라인 반환
function openStrips(strips) {
    return gsap.timeline().to(
        strips.flatMap((s) => [s.top, s.bottom]),
        {
            attr: {
                y: (i) => {
                    const s = strips[Math.floor(i / 2)];
                    return i % 2 === 0 ? s.y - s.h : s.y;
                },
                height: (i) => {
                    const s = strips[Math.floor(i / 2)];
                    return s.h + 0.01;
                },
            },
            ease: "power3.out",
            stagger: {
                each: 0.02,
                from: "start",
            },
        }
    );
}

function captionIn(el) {
    return gsap.to(el, {
        clipPath: "inset(0% 0% 0% 0%)",
        y: 0,
        duration: 1,
        ease: "expo.out"
    });
}

function captionOut(el) {
    return gsap.to(el, {
        clipPath: "inset(0% 0% 100% 0%)",
        y: -30,
        duration: 0.8,
        ease: "power2.inOut"
    });
}

// 스크롤 전체 타임라인 생성 (ScrollTrigger 연결)
function buildScrollTimeline() {
    if (masterTimeline) masterTimeline.kill();
    const captions = gsap.utils.toArray(".caption");

    masterTimeline = gsap.timeline({
        scrollTrigger: {
            trigger: ".scroll-stage",
            start: "top top",
            end: "bottom bottom",
            scrub: 2,
            invalidateOnRefresh: true,
        }
    });

    maskStrips.forEach((strips, i) => {
        masterTimeline.add(openStrips(strips));

        if (captions[i]) {
            masterTimeline.add(captionIn(captions[i]), "-=0.3");
            masterTimeline.add(captionOut(captions[i]), "+=0.8");
        }
    });
}

function initProgress() {
    const progressFills = gsap.utils.toArray(".progress-fill");

    ScrollTrigger.create({
        trigger: ".scroll-stage",
        start: "top top",
        end: "bottom bottom",
        scrub: 0.3,
        onUpdate: (self) => {
            const progress = self.progress;
            const totalSteps = progressFills.length;

            progressFills.forEach((fill, i) => {
                let p = (progress - i / totalSteps) * totalSteps;
                p = Math.max(0, Math.min(1, p));
                fill.style.width = `${p * 100}%`;
            });
        }
    })
}

// 초기 실행
window.addEventListener("load", () => {
    updateScene();
    initProgress();
});

// 리사이즈 시 재계산 (debounce 250ms)
let resizeTimer;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        updateScene();
    }, 250);
});