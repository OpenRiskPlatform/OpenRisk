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

          # export GSETTINGS_SCHEMA_DIR=${gsettingsSchemas}
          # export XDG_DATA_DIRS=${pkgs.gsettings-desktop-schemas}/share:$XDG_DATA_DIRS
        shellHook = ''
          fish
        '';
      };
    };
}
