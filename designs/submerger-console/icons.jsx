/**
 * 统一渲染原型中的线性图标。
 * @param {object} props 图标属性。
 * @param {string} props.name 图标名称。
 * @param {number} [props.size=18] 图标尺寸。
 * @param {string} [props.className=""] 附加样式类名。
 * @param {number} [props.strokeWidth=1.8] 描边宽度。
 * @returns {React.ReactElement} 可访问的装饰性 SVG 图标。
 */
function Icon({ name, size = 18, className = "", strokeWidth = 1.8 }) {
  const commonProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": "true"
  };

  const paths = {
    grid: <React.Fragment><rect x="3" y="3" width="7" height="7" rx="2"></rect><rect x="14" y="3" width="7" height="7" rx="2"></rect><rect x="3" y="14" width="7" height="7" rx="2"></rect><rect x="14" y="14" width="7" height="7" rx="2"></rect></React.Fragment>,
    subscription: <React.Fragment><path d="M5 5.8A13 13 0 0 1 18.2 19"></path><path d="M5 11.2A7.6 7.6 0 0 1 12.8 19"></path><circle cx="5.5" cy="18.5" r="1.5"></circle></React.Fragment>,
    server: <React.Fragment><rect x="3" y="4" width="18" height="6" rx="2"></rect><rect x="3" y="14" width="18" height="6" rx="2"></rect><path d="M7 7h.01M7 17h.01"></path><path d="M17 7h1M17 17h1"></path></React.Fragment>,
    route: <React.Fragment><circle cx="6" cy="18" r="2"></circle><circle cx="18" cy="6" r="2"></circle><path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"></path><path d="m8 8 3-3 3 3"></path><path d="M11 5v6"></path></React.Fragment>,
    link: <React.Fragment><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"></path><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"></path></React.Fragment>,
    settings: <React.Fragment><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"></path></React.Fragment>,
    search: <React.Fragment><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></React.Fragment>,
    plus: <React.Fragment><path d="M12 5v14M5 12h14"></path></React.Fragment>,
    chevronRight: <path d="m9 18 6-6-6-6"></path>,
    chevronDown: <path d="m6 9 6 6 6-6"></path>,
    check: <path d="m5 12 4 4L19 6"></path>,
    warning: <React.Fragment><path d="M10.3 3.7 2.5 17.2A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.8L13.7 3.7a2 2 0 0 0-3.4 0Z"></path><path d="M12 9v4M12 17h.01"></path></React.Fragment>,
    error: <React.Fragment><circle cx="12" cy="12" r="9"></circle><path d="m9 9 6 6M15 9l-6 6"></path></React.Fragment>,
    grip: <React.Fragment><circle cx="9" cy="7" r="1" fill="currentColor" stroke="none"></circle><circle cx="15" cy="7" r="1" fill="currentColor" stroke="none"></circle><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"></circle><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"></circle><circle cx="9" cy="17" r="1" fill="currentColor" stroke="none"></circle><circle cx="15" cy="17" r="1" fill="currentColor" stroke="none"></circle></React.Fragment>,
    flask: <React.Fragment><path d="M9 3h6M10 3v6l-5.5 9.1A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.9L14 9V3"></path><path d="M7.5 16h9"></path></React.Fragment>,
    eye: <React.Fragment><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.5"></circle></React.Fragment>,
    upload: <React.Fragment><path d="M12 16V4"></path><path d="m7 9 5-5 5 5"></path><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"></path></React.Fragment>,
    save: <React.Fragment><path d="M5 3h12l3 3v15H4V4a1 1 0 0 1 1-1Z"></path><path d="M8 3v6h8V3M8 21v-7h8v7"></path></React.Fragment>,
    copy: <React.Fragment><rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></React.Fragment>,
    trash: <React.Fragment><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"></path></React.Fragment>,
    duplicate: <React.Fragment><rect x="8" y="8" width="12" height="12" rx="2"></rect><rect x="4" y="4" width="12" height="12" rx="2"></rect></React.Fragment>,
    filter: <React.Fragment><path d="M4 5h16l-6 7v5l-4 2v-7Z"></path></React.Fragment>,
    nodes: <React.Fragment><circle cx="6" cy="6" r="2"></circle><circle cx="18" cy="6" r="2"></circle><circle cx="12" cy="18" r="2"></circle><path d="m7.7 7.1 3.1 8.1M16.3 7.1l-3.1 8.1M8 6h8"></path></React.Fragment>,
    layers: <React.Fragment><path d="m12 3 9 5-9 5-9-5 9-5Z"></path><path d="m3 12 9 5 9-5M3 16l9 5 9-5"></path></React.Fragment>,
    code: <React.Fragment><path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14"></path></React.Fragment>,
    import: <React.Fragment><path d="M12 3v12M7 10l5 5 5-5"></path><path d="M5 20h14"></path></React.Fragment>,
    external: <React.Fragment><path d="M14 4h6v6M20 4l-9 9"></path><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"></path></React.Fragment>,
    more: <React.Fragment><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"></circle><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"></circle></React.Fragment>,
    x: <path d="m6 6 12 12M18 6 6 18"></path>,
    refresh: <React.Fragment><path d="M20 7v5h-5"></path><path d="M19 12a7 7 0 1 1-2-5"></path></React.Fragment>,
    arrowUp: <React.Fragment><path d="M12 19V5M6 11l6-6 6 6"></path></React.Fragment>,
    arrowDown: <React.Fragment><path d="M12 5v14M18 13l-6 6-6-6"></path></React.Fragment>,
    history: <React.Fragment><path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path d="M3 4v4h4M12 7v5l3 2"></path></React.Fragment>,
    command: <React.Fragment><path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3Z"></path></React.Fragment>,
    shield: <React.Fragment><path d="M12 3 5 6v5c0 4.4 2.8 8.4 7 10 4.2-1.6 7-5.6 7-10V6l-7-3Z"></path><path d="m9 12 2 2 4-4"></path></React.Fragment>
  };

  return <svg {...commonProps}>{paths[name] || paths.grid}</svg>;
}

Object.assign(window, { Icon });
