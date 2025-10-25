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
      tauriAppimageEnv = pkgs.buildFHSEnv {
        name = "tauri-appimage-env";
        targetPkgs =
          pkgs: with pkgs; [
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
            xdg-utils
          ];
      };
    in
    {
      devShells.${system}.default = pkgs.mkShell rec {
        nativeBuildInputs = with pkgs; [
          pkg-config
          gobject-introspection
          cargo
          cargo-tauri
          nodejs
          rustPlatform.bindgenHook
        ];

        buildInputs = with pkgs; [
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
        ];

        packages =
          with pkgs;
          [
            xdg-utils
            go-task
            appimage-run
            mesa
            libglvnd
            gsettings-desktop-schemas
            rustc
          ]
          ++ [ tauriAppimageEnv ];

        shellHook = ''
          export TAURI_FHS="${tauriAppimageEnv}/bin/tauri-appimage-env"
          echo "Tauri AppImage builds: run \"$TAURI_FHS -- npx tauri build --bundles appimage\" to bundle inside an FHS sandbox with /usr/bin/xdg-open."
        '';
      };
    };
}
