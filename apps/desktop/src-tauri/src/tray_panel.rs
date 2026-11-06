//! macOS 27 expanded interface for status items. The content stays in a
//! fullscreen auxiliary panel, including the submenu rows.

use crate::tray_menu::Entry;
use crate::tray_state::TrayNodeRow;
use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2::{sel, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{
    NSBackingStoreType, NSBezelStyle, NSButton, NSColor, NSEvent, NSPanel, NSScreen, NSScrollView,
    NSStatusWindowLevel, NSTextAlignment, NSView, NSWindowCollectionBehavior, NSWindowStyleMask,
};
use objc2_foundation::{NSPoint, NSPointInRect, NSRect, NSSize, NSString};

const PANEL_WIDTH: f64 = 328.0;
const ROW_HEIGHT: f64 = 30.0;
const PADDING: f64 = 10.0;

#[derive(Clone, PartialEq, Eq)]
pub(crate) enum Selection {
    Action(String),
    Submenu(&'static str),
    Back,
}

pub(crate) struct TrayPanel {
    panel: Retained<NSPanel>,
    anchor: NSPoint,
    screen: NSRect,
    page: Option<&'static str>,
    rows: Vec<Option<(Selection, Retained<NSButton>)>>,
}

impl TrayPanel {
    pub(crate) fn new(mtm: MainThreadMarker) -> Self {
        let panel = NSPanel::initWithContentRect_styleMask_backing_defer(
            NSPanel::alloc(mtm),
            NSRect::ZERO,
            NSWindowStyleMask::Borderless | NSWindowStyleMask::NonactivatingPanel,
            NSBackingStoreType::Buffered,
            false,
        );
        panel.setLevel(NSStatusWindowLevel);
        panel.setCollectionBehavior(
            NSWindowCollectionBehavior::CanJoinAllSpaces
                | NSWindowCollectionBehavior::CanJoinAllApplications
                | NSWindowCollectionBehavior::FullScreenAuxiliary,
        );
        panel.setHidesOnDeactivate(false);
        panel.setHasShadow(true);
        panel.setBackgroundColor(Some(&NSColor::windowBackgroundColor()));
        Self {
            panel,
            anchor: NSPoint::ZERO,
            screen: NSRect::ZERO,
            page: None,
            rows: Vec::new(),
        }
    }

    pub(crate) fn begin(&mut self, mtm: MainThreadMarker) {
        self.anchor = NSEvent::mouseLocation();
        self.screen = NSScreen::screens(mtm)
            .iter()
            .find(|screen| {
                let frame = screen.frame();
                (frame.origin.x..frame.origin.x + frame.size.width).contains(&self.anchor.x)
                    && (frame.origin.y..frame.origin.y + frame.size.height).contains(&self.anchor.y)
            })
            .or_else(|| NSScreen::mainScreen(mtm))
            .map(|screen| screen.frame())
            .unwrap_or(NSRect::new(NSPoint::ZERO, NSSize::new(800.0, 600.0)));
        self.page = None;
        self.rows.clear();
    }

    pub(crate) fn hide(&self) {
        self.panel.orderOut(None);
    }

    pub(crate) fn contains_pointer(&self) -> bool {
        let point = NSEvent::mouseLocation();
        // AppKit or the button's secondary action handles menu-bar clicks.
        NSPointInRect(point, self.panel.frame())
            || (NSPointInRect(point, self.screen)
                && point.y >= self.screen.origin.y + self.screen.size.height - 39.0)
    }

    pub(crate) fn choose(&self, index: isize) -> Option<Selection> {
        let (selection, _) = self.rows.get(usize::try_from(index).ok()?)?.as_ref()?;
        Some(selection.clone())
    }

    pub(crate) fn set_page(&mut self, page: Option<&'static str>) {
        self.page = page;
        self.rows.clear();
    }

    pub(crate) fn render(
        &mut self,
        entries: &[Entry],
        nodes: &[TrayNodeRow],
        target: &AnyObject,
        mtm: MainThreadMarker,
    ) {
        let mut rows = Vec::new();
        let submenu = self.page.and_then(|page| {
            entries.iter().find_map(|entry| match entry {
                Entry::Submenu(id, title, children) if *id == page => Some((title, children)),
                _ => None,
            })
        });
        let shown = if let Some((title, children)) = submenu {
            rows.push((format!("‹  {title}"), true, Some(Selection::Back)));
            children.as_slice()
        } else {
            self.page = None;
            entries
        };
        for entry in shown {
            rows.push(match entry {
                Entry::Separator => (String::new(), false, None),
                Entry::Submenu(id, title, _) => {
                    (format!("{title}  ›"), true, Some(Selection::Submenu(id)))
                }
                Entry::Action {
                    id,
                    title,
                    enabled,
                    checked,
                } => {
                    let mut text = if *checked == Some(true) {
                        format!("✓  {title}")
                    } else {
                        title.clone()
                    };
                    if let Some(node) = id
                        .strip_prefix("node-")
                        .and_then(|name| nodes.iter().find(|node| node.name == name))
                    {
                        if let Some(current) = &node.current_node {
                            text.push_str(&format!(" → {current}"));
                        }
                        let badge = if node.pending { "…" } else { &node.badge };
                        text.push_str(&format!("  ·  {badge}"));
                    }
                    (text, *enabled, Some(Selection::Action(id.clone())))
                }
            });
        }

        if rows.len() == self.rows.len()
            && rows
                .iter()
                .zip(&self.rows)
                .all(|((_, _, action), existing)| {
                    action.as_ref() == existing.as_ref().map(|(selection, _)| selection)
                })
        {
            // Keep buttons and the scroll position when only test results
            // change, including when a click is already in progress.
            for ((title, enabled, _), existing) in rows.iter().zip(&self.rows) {
                if let Some((_, row)) = existing {
                    let title = NSString::from_str(title);
                    if row.title() != title {
                        row.setTitle(&title);
                        row.setToolTip(Some(&title));
                    }
                    row.setEnabled(*enabled);
                }
            }
            return;
        }

        let width = PANEL_WIDTH.min(self.screen.size.width - PADDING * 2.0);
        let content_height = ROW_HEIGHT * rows.len() as f64 + PADDING * 2.0;
        let top = self.screen.origin.y + self.screen.size.height - 39.0;
        let height = content_height.min((self.screen.size.height - 60.0).min(450.0));
        let left = (self.anchor.x - width / 2.0).clamp(
            self.screen.origin.x + PADDING,
            self.screen.origin.x + self.screen.size.width - width - PADDING,
        );
        let frame = NSRect::new(NSPoint::new(left, top - height), NSSize::new(width, height));
        let scroll = NSScrollView::initWithFrame(
            NSScrollView::alloc(mtm),
            NSRect::new(NSPoint::ZERO, frame.size),
        );
        scroll.setHasVerticalScroller(content_height > height);
        scroll.setAutohidesScrollers(true);
        scroll.setDrawsBackground(false);
        let document = NSView::initWithFrame(
            NSView::alloc(mtm),
            NSRect::new(NSPoint::ZERO, NSSize::new(width, content_height)),
        );
        self.rows.clear();
        for (index, (title, enabled, selection)) in rows.into_iter().enumerate() {
            let Some(selection) = selection else {
                self.rows.push(None);
                continue;
            };
            let row = unsafe {
                NSButton::buttonWithTitle_target_action(
                    &NSString::from_str(&title),
                    Some(target),
                    Some(sel!(trayPanelAction:)),
                    mtm,
                )
            };
            row.setTag(index as isize);
            row.setEnabled(enabled);
            row.setToolTip(Some(&NSString::from_str(&title)));
            row.setAlignment(NSTextAlignment::Left);
            row.setBezelStyle(NSBezelStyle::Push);
            row.setFrame(NSRect::new(
                NSPoint::new(
                    PADDING,
                    content_height - PADDING - ROW_HEIGHT * (index + 1) as f64,
                ),
                NSSize::new(width - 2.0 * PADDING, ROW_HEIGHT),
            ));
            document.addSubview(&row);
            self.rows.push(Some((selection, row)));
        }
        scroll.setDocumentView(Some(&document));
        document.scrollPoint(NSPoint::new(0.0, (content_height - height).max(0.0)));
        self.panel.setFrame_display(frame, false);
        self.panel.setContentView(Some(&scroll));
        self.panel.orderFrontRegardless();
    }
}
