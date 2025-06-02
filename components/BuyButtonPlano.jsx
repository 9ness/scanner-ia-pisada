// BuyButtonPlano.jsx
import { useEffect } from 'react';

const BuyButtonPlano = () => {
  useEffect(() => {
    const scriptId = 'shopify-buy-button-script';

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
      const existing = document.getElementById('product-component-plano');
      if (existing) existing.innerHTML = ''; // 🔄 Reinicia el contenedor

      if (!window.ShopifyBuy) return;

      if (window.ShopifyBuy.UI) {
        const client = window.ShopifyBuy.buildClient({
          domain: '0ssfqf-rv.myshopify.com',
          storefrontAccessToken: 'c055a6bf600ea75fe12442dfe7b29285',
        });

        window.ShopifyBuy.UI.onReady(client).then((ui) => {
          ui.createComponent('product', {
            id: '15033068716358',
            node: document.getElementById('product-component-plano'),
            moneyFormat: '%E2%82%AC%7B%7Bamount_with_comma_separator%7D%7D',
            options: {
              product: {
                styles: {
                  product: {
                    textAlign: 'center',
                  },
                },
                buttonDestination: 'modal',
                contents: {
                  button: false, // ⛔ Oculta el botón
                  options: false,
                },
                text: { button: 'Ver producto' },
              },
              modalProduct: {
                contents: {
                  img: false,
                  imgWithCarousel: true,
                  button: false,
                  buttonWithQuantity: true,
                },
              },
            },
          });
        });
      }
    }
  }, []);

  return <div id="product-component-plano" />;
};

export default BuyButtonPlano;
