import { useEffect } from 'react';

const BuyButtonPlano = () => {
  useEffect(() => {
    const scriptId = 'shopify-buy-button-script-plano';

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.src = 'https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js';
      script.async = true;
      script.id = scriptId;
      script.onload = renderBuyButton;
      document.body.appendChild(script);
    } else {
      renderBuyButton();
    }

    function renderBuyButton() {
      if (!window.ShopifyBuy) return;
      if (window.ShopifyBuy.UI) {
        const client = window.ShopifyBuy.buildClient({
          domain: '0ssfqf-rv.myshopify.com',
          storefrontAccessToken: 'c055a6bf600ea75fe12442dfe7b29285',
        });

        window.ShopifyBuy.UI.onReady(client).then((ui) => {
          ui.createComponent('product', {
            id: '15033068716358', // Producto pie plano
            node: document.getElementById('product-component-plano'),
            moneyFormat: '%E2%82%AC%7B%7Bamount_with_comma_separator%7D%7D',
            options: {
              product: {
                styles: {
                  product: {
                    display: 'flex',
                    justifyContent: 'center',
                    margin: '0 auto',
                    '@media (min-width: 601px)': {
                      maxWidth: 'calc(25% - 20px)',
                      marginLeft: '20px',
                      marginBottom: '50px',
                    },
                  },
                  title: {
                    fontFamily: 'Open Sans, sans-serif',
                    textAlign: 'center',
                  },
                  button: {
                    borderRadius: '15px',
                  },
                  price: { color: '#3e3e3e', textAlign: 'center' },
                  compareAt: { color: '#3e3e3e' },
                  unitPrice: { color: '#3e3e3e' },
                },
                buttonDestination: 'modal',
                contents: {
                  button: false,
                  options: false,
                },

                text: { button: 'Ver producto' },
                googleFonts: ['Open Sans'],
              },
              modalProduct: {
                contents: {
                  img: false,
                  imgWithCarousel: true,
                  button: false,
                  buttonWithQuantity: true,
                },
                styles: {
                  product: {
                    '@media (min-width: 601px)': {
                      maxWidth: '100%',
                      marginLeft: '0px',
                      marginBottom: '0px',
                    },
                  },
                  button: { borderRadius: '15px' },
                  title: {
                    fontFamily: 'Helvetica Neue, sans-serif',
                    fontWeight: 'bold',
                    fontSize: '26px',
                    color: '#4c4c4c',
                  },
                  price: {
                    fontFamily: 'Helvetica Neue, sans-serif',
                    fontWeight: 'normal',
                    fontSize: '18px',
                    color: '#4c4c4c',
                  },
                  compareAt: {
                    fontFamily: 'Helvetica Neue, sans-serif',
                    fontWeight: 'normal',
                    fontSize: '15.3px',
                    color: '#4c4c4c',
                  },
                  unitPrice: {
                    fontFamily: 'Helvetica Neue, sans-serif',
                    fontWeight: 'normal',
                    fontSize: '15.3px',
                    color: '#4c4c4c',
                  },
                },
                text: { button: 'Add to cart' },
              },
              cart: {
                styles: {
                  button: { borderRadius: '15px' },
                },
                text: {
                  title: 'Carrito',
                  total: 'Subtotal',
                  empty: 'Su cesta está vacía.',
                  notice: 'Los códigos de descuento se añaden al finalizar la compra.',
                  button: 'Pedido',
                },
                popup: false,
              },
            },
          });
        });
      }
    }
  }, []);

  return (
    <div id="product-component-plano" style={{ display: 'flex', justifyContent: 'center' }} />
  );
};

export default BuyButtonPlano;
