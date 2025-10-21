{
  description = "OpenRisk helpers for Nix/NixOS";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };

      appimagePath =
        let
          path = ./dist/openrisk_0.1.0_amd64.AppImage;
        in
        if builtins.pathExists path then path else
          throw "dist/openrisk_0.1.0_amd64.AppImage is missing. Build it first with the Docker image.";

      openriskApp = pkgs.appimageTools.wrapType2 {
        pname = "openrisk";
        version = "0.1.0";
        src = appimagePath;
        extraPkgs = pkgs': with pkgs'; [
          stdenv.cc.cc.lib      # libstdc++
          zlib                  # libz.so needed by webkit
          e2fsprogs             # libcom_err.so.2
          mesa
          libglvnd
          libdrm
          libxkbcommon
          gtk3
          webkitgtk_4_1
          libsoup_3
          glib
          pango
          gdk-pixbuf
          xorg.libX11
          xorg.libXext
          xorg.libXcomposite
          xorg.libXdamage
          xorg.libXrender
          xorg.libXrandr
          xorg.libXi
          xorg.libxcb
        ];
        profile = ''
          export WEBKIT_DISABLE_COMPOSITING_MODE=1
          export WEBKIT_DISABLE_DMABUF_RENDERER=1
          export LIBGL_ALWAYS_SOFTWARE=1
          export GDK_BACKEND=x11
        '';
      };
    in {
      packages.${system}.default = openriskApp;

      apps.${system}.default = {
        type = "app";
        program = "${openriskApp}/bin/openrisk";
      };

      devShells.${system}.default = pkgs.mkShell {
        packages = with pkgs; [
          appimage-run
          mesa
          libglvnd
          gtk3
          webkitgtk_4_1
          libsoup_3
          libxcb
        ];
      };
    };
}
