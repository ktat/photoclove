// Scrollable.js
import React, { useRef, useState, useEffect } from 'react';

export default function Scrollable({ hasNext, hasPrev = false, children, className = '', f = function (e) { } }) {
    const box = useRef(null);

    // 影を出す／消すフラグ
    const [shadow, setShadow] = useState({
        top: false,
        bottom: false,
        left: false,
        right: false,
    });

    // スクロール位置から影の有無を計算
    const updateShadow = () => {
        console.log('updateShadow');
        const el = box.current;
        if (!el) return;
        console.log('updateShadow 2');
        setShadow({
            top: (el.scrollTop > 0) || hasPrev,
            bottom: (el.scrollTop + el.clientHeight < el.scrollHeight) || hasNext,
            left: el.scrollLeft > 0,
            right: el.scrollLeft + el.clientWidth < el.scrollWidth,
        });
    };

    // 初期化 + リスナー登録
    useEffect(() => {
        updateShadow();
        const el = box.current;
        if (!el) return;
        el.addEventListener('scroll', updateShadow, { passive: true });
        window.addEventListener('resize', updateShadow);
        return () => {
            el.removeEventListener('scroll', updateShadow);
            window.removeEventListener('resize', updateShadow);
        };
    }, []);

    return (
        <div className={`scroll-wrapper ${className}`}>
            {shadow.top && <div className="fade fade-top" />}
            {shadow.bottom && <div className="fade fade-bottom" />}
            {shadow.left && <div className="fade fade-left" />}
            {shadow.right && <div className="fade fade-right" />}
            {console.log(shadow)}
            {/* 実際にスクロールする要素 */}
            <div className="scroll-box" onWheel={f} ref={box}>
                {children}
            </div>
        </div>
    );
}