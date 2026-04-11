{
  description = "OpenRisk helpers for Nix/NixOS";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in
    {
      devShells.${system}.default = pkgs.mkShell rec {
        nativeBuildInputs = with pkgs; [
          rustup
          pkg-config
          gobject-introspection
          cargo
          cargo-tauri
          nodejs
          rustPlatform.bindgenHook
        ];

        buildInputs = with pkgs; [
          gst_all_1.gstreamer.out
          gst_all_1.gst-plugins-base
          gst_all_1.gst-plugins-good
          gst_all_1.gst-plugins-bad
          gst_all_1.gst-libav
        ];

        packages = with pkgs; [
          llvmPackages_21.libllvm
          lld_21
          nsis
          deno
          xdg-utils
          go-task
          appimage-run
          mesa
          libglvnd
          gsettings-desktop-schemas
          rustc
          rust-analyzer
          cargo
          cargo-xwin
          gcc
          clippy
          rustfmt
          cargo-typify
          at-spi2-atk
          atkmm
          cairo
          gdk-pixbuf
          glib
          glib-networking
          gtk3
          harfbuzz
          librsvg
          libsoup_3
          pango
          webkitgtk_4_1
          openssl
          libxcb
          libffi
          glib.dev
          gtk3.dev
          libffi.dev
          gsettings-desktop-schemas
        ];

          # WebKitGTK/libsoup load TLS support via GIO modules from glib-networking.
          # Without this, HTTPS requests in the Tauri webview fail with
          # "TLS support is not available".
        shellHook = ''
          export GIO_MODULE_DIR="${pkgs.glib-networking}/lib/gio/modules"
          export GIO_EXTRA_MODULES="${pkgs.glib-networking}/lib/gio/modules:$GIO_EXTRA_MODULES"
          export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:$XDG_DATA_DIRS"
          export GST_PLUGIN_SYSTEM_PATH_1_0="${pkgs.gst_all_1.gstreamer.out}/lib/gstreamer-1.0:${pkgs.gst_all_1.gst-plugins-base}/lib/gstreamer-1.0:${pkgs.gst_all_1.gst-plugins-good}/lib/gstreamer-1.0:${pkgs.gst_all_1.gst-plugins-bad}/lib/gstreamer-1.0:${pkgs.gst_all_1.gst-libav}/lib/gstreamer-1.0"
          export GST_PLUGIN_SCANNER="${pkgs.gst_all_1.gstreamer.out}/libexec/gstreamer-1.0/gst-plugin-scanner"
          export LD_LIBRARY_PATH="${pkgs.gst_all_1.gstreamer.out}/lib:${pkgs.gst_all_1.gst-plugins-base}/lib:${pkgs.gst_all_1.gst-plugins-good}/lib:${pkgs.gst_all_1.gst-plugins-bad}/lib:${pkgs.gst_all_1.gst-libav}/lib:$LD_LIBRARY_PATH"
          fish
        '';
      };
    };
}
