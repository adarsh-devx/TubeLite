fn main() {
    // Declare custom cfg values for check-cfg
    println!("cargo::rustc-check-cfg=cfg(mobile)");
}
